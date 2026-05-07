import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { Terminal as TerminalIcon, Wifi, Maximize2, Minimize2 } from 'lucide-react';

import { io, Socket } from 'socket.io-client';

interface Props {
  serverId: number;
  serverName: string;
}

export default function Terminal({ serverId, serverName }: Props) {
  const { token } = useStore();
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'closed'>('connecting');
  const [fullscreen, setFullscreen] = useState(false);


  useEffect(() => {
    let mounted = true;

    async function init() {
      // Dynamically import xterm to keep initial bundle small
      const { Terminal: XTerm } = await import('xterm');
      const { FitAddon } = await import('xterm-addon-fit');
      await import('xterm/css/xterm.css');

      if (!termRef.current || !mounted) return;

      const term = new XTerm({
        theme: {
          background: '#0a0e1a',
          foreground: '#e2e8f0',
          cursor: '#6366f1',
          cursorAccent: '#0a0e1a',
          black: '#1e293b', red: '#ef4444', green: '#22c55e',
          yellow: '#f59e0b', blue: '#6366f1', magenta: '#a855f7',
          cyan: '#06b6d4', white: '#f1f5f9',
          brightBlack: '#475569', brightRed: '#fca5a5', brightGreen: '#86efac',
          brightYellow: '#fde68a', brightBlue: '#a5b4fc', brightMagenta: '#d8b4fe',
          brightCyan: '#67e8f9', brightWhite: '#f8fafc',
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 1000,
        allowTransparency: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitRef.current = fitAddon;

      // Connect to Socket.IO
      const socket = io(window.location.origin, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('terminal:start', {
          serverId,
          token,
          cols: term.cols,
          rows: term.rows,
        });
      });

      socket.on('terminal:ready', () => {
        if (!mounted) return;
        setStatus('connected');
        term.write('\r\n\x1b[32m● Connected to ' + serverName + '\x1b[0m\r\n\r\n');
      });

      socket.on('terminal:output', (data: string) => {
        term.write(data);
      });

      socket.on('terminal:error', (msg: string) => {
        if (!mounted) return;
        setStatus('error');
        term.write(`\r\n\x1b[31m✖ Error: ${msg}\x1b[0m\r\n`);
      });

      socket.on('terminal:closed', () => {
        if (!mounted) return;
        setStatus('closed');
        term.write('\r\n\x1b[33m⚡ SSH session closed.\x1b[0m\r\n');
      });

      // Send user input to SSH
      term.onData((data) => {
        socket.emit('terminal:input', data);
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          socket.emit('terminal:resize', { cols: term.cols, rows: term.rows });
        } catch {}
      });
      if (termRef.current) resizeObserver.observe(termRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }

    init();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      xtermRef.current?.dispose();
    };
  }, [serverId]);

  const reconnect = () => {
    socketRef.current?.disconnect();
    xtermRef.current?.dispose();
    xtermRef.current = null;
    setStatus('connecting');
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const statusColors: Record<string, string> = {
    connecting: '#f59e0b',
    connected: '#22c55e',
    error: '#ef4444',
    closed: '#94a3b8',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: fullscreen ? '100vh' : 520,
      position: fullscreen ? 'fixed' : 'relative',
      top: fullscreen ? 0 : 'auto', left: fullscreen ? 0 : 'auto',
      right: fullscreen ? 0 : 'auto', bottom: fullscreen ? 0 : 'auto',
      zIndex: fullscreen ? 9999 : 'auto',
      background: '#0a0e1a',
      borderRadius: fullscreen ? 0 : 12,
      border: '1px solid rgba(99,120,195,0.15)',
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
        background: 'rgba(15,22,41,0.95)', borderBottom: '1px solid rgba(99,120,195,0.1)',
        flexShrink: 0,
      }}>
        <TerminalIcon size={14} color="#6366f1" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>
          SSH: {serverName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[status] }} />
          <span style={{ fontSize: 10, color: statusColors[status], textTransform: 'capitalize' }}>{status}</span>
        </div>
        <button
          onClick={() => setFullscreen(f => !f)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
          title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        {(status === 'error' || status === 'closed') && (
          <button
            onClick={reconnect}
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#a5b4fc', cursor: 'pointer' }}
          >
            Reconnect
          </button>
        )}
      </div>

      {/* Terminal canvas */}
      <div
        ref={termRef}
        style={{ flex: 1, padding: '8px 4px', overflow: 'hidden' }}
      />

      {/* Connecting overlay */}
      {status === 'connecting' && (
        <div style={{
          position: 'absolute', top: 40, left: 0, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,26,0.7)', backdropFilter: 'blur(4px)',
          flexDirection: 'column', gap: 12,
        }}>
          <Wifi size={28} color="#6366f1" style={{ animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Establishing SSH connection...</span>
        </div>
      )}
    </div>
  );
}
