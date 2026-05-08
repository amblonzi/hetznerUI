import { useEffect, useState } from 'react';
import { useStore, api } from '../store';
import { ArrowLeft, Wifi, HardDrive, Activity, Plug, ScrollText, RefreshCw, Trash2, Play, Square, RotateCw, Thermometer, FolderOpen, Globe, Clock, TerminalSquare, Plus, X, File, ChevronRight, Eye, UploadCloud, ShieldCheck, ShieldAlert, Save, Cpu, GitBranch, Users, Shield } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import Terminal from './Terminal';

type DetailTab = 'processes' | 'services' | 'connections' | 'logs' | 'hardware' | 'files' | 'sites' | 'database' | 'terminal' | 'cron' | 'performance' | 'security' | 'software' | 'git' | 'users' | 'waf';

export default function ServerDetail() {
  const { servers, selectedServerId, setPage, showToast } = useStore();
  const srv = servers.find(s => s.id === selectedServerId);

  const [tab, setTab] = useState<DetailTab>('processes');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [processes, setProcesses] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [logs, setLogs] = useState('');
  const [hardware, setHardware] = useState('');
  const [logService, setLogService] = useState('');
  const [logLines, setLogLines] = useState('100');
  const [logSearch, setLogSearch] = useState('');
  const [killConfirm, setKillConfirm] = useState<string | null>(null);
  const [processSort, setProcessSort] = useState<'cpu' | 'mem'>('cpu');
  const [filePath, setFilePath] = useState('/');
  const [fileEntries, setFileEntries] = useState<any[]>([]);
  const [fileContent, setFileContent] = useState<{content: string; path: string} | null>(null);
  const [sites, setSites] = useState<Record<string, string>>({});
  const [dbInfo, setDbInfo] = useState<Record<string, string>>({});
  const [backups, setBackups] = useState('');
  const [backupRunning, setBackupRunning] = useState(false);
  const [crons, setCrons] = useState<any[]>([]);
  const [newCron, setNewCron] = useState({ minute: '*', hour: '*', day: '*', month: '*', weekday: '*', command: '' });
  const [showCronForm, setShowCronForm] = useState(false);
  const [metricHistory, setMetricHistory] = useState<any[]>([]);
  const [metricRange, setMetricRange] = useState('1h');
  const [firewall, setFirewall] = useState('');
  const [sslDomain, setSslDomain] = useState('');
  const [sslEmail, setSslEmail] = useState('');
  const [softwareStatus, setSoftwareStatus] = useState<Record<string, string>>({});
  const [dbData, setDbData] = useState<{table: string, columns: string[], rows: any[], dbType: string, dbName: string} | null>(null);
  const [gitHooks, setGitHooks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [wafRules, setWafRules] = useState<string[]>([]);
  const [modal, setModal] = useState<{type: 'tables' | 'edit-record' | 'json' | 'input', data: any} | null>(null);
  const [siteType, setSiteType] = useState('static');

  useEffect(() => {
    if (srv) loadInfo();
  }, [selectedServerId]);

  useEffect(() => {
    if (srv) {
      loadTabData();
      loadInfo();
    }
  }, [tab, selectedServerId, metricRange]);

  async function loadInfo() {
    try {
      const data = await api(`/api/servers/${srv!.id}/info`);
      setInfo(data);
    } catch (e) { console.error(e); }
  }

  async function loadTabData() {
    if (!srv) return;
    setLoading(true);
    try {
      switch (tab) {
        case 'processes': {
          const data = await api(`/api/servers/${srv.id}/processes`);
          setProcesses(data.processes || []);
          break;
        }
        case 'services': {
          const data = await api(`/api/servers/${srv.id}/services`);
          setServices(data.services || []);
          break;
        }
        case 'connections': {
          const data = await api(`/api/servers/${srv.id}/connections`);
          setConnections(data.connections || []);
          break;
        }
        case 'logs': {
          const params = new URLSearchParams();
          if (logService) params.set('service', logService);
          if (logLines) params.set('lines', logLines);
          if (logSearch) params.set('search', logSearch);
          const data = await api(`/api/servers/${srv.id}/logs?${params}`);
          setLogs(data.logs || 'No logs available');
          break;
        }
        case 'hardware': {
          const data = await api(`/api/servers/${srv.id}/hardware`);
          setHardware(data.raw || 'No hardware data');
          break;
        }
        case 'files': {
          const data = await api(`/api/servers/${srv.id}/files?path=${encodeURIComponent(filePath)}`);
          setFileEntries(data.entries || []);
          break;
        }
        case 'sites': {
          const data = await api(`/api/servers/${srv.id}/sites`);
          setSites(data.sections || {});
          break;
        }
        case 'database': {
          const [dbData, bkData] = await Promise.all([
            api(`/api/servers/${srv.id}/databases`),
            api(`/api/servers/${srv.id}/backups`),
          ]);
          setDbInfo(dbData.sections || {});
          setBackups(bkData.output || '');
          break;
        }
        case 'cron': {
          const data = await api(`/api/servers/${srv.id}/crons`);
          setCrons(data.crons || []);
          break;
        }
        case 'performance': {
          const data = await api(`/api/metrics/${srv.ip}/history?range=${metricRange}`);
          setMetricHistory(data.metrics || []);
          break;
        }
        case 'security': {
          const data = await api(`/api/servers/${srv.id}/firewall`);
          setFirewall(data.output || '');
          break;
        }
        case 'software': {
          const data = await api(`/api/servers/${srv.id}/software`);
          setSoftwareStatus(data.status || {});
          break;
        }
        case 'git': {
          const data = await api(`/api/webhooks`);
          setGitHooks(data.webhooks.filter((w: any) => w.server_id === srv.id) || []);
          break;
        }
        case 'users': {
          const data = await api(`/api/users`);
          setUsers(data.users || []);
          break;
        }
        case 'waf': {
          // Check if WAF file exists (simple way)
          const data = await api(`/api/servers/${srv.id}/files?path=/etc/nginx/conf.d`);
          const exists = data.entries?.some((e: any) => e.name === 'basic_waf.conf');
          setWafRules(exists ? ['basic_waf'] : []);
          break;
        }
      }
    } catch (e: any) { showToast(e.message, 'error'); }
    setLoading(false);
  }

  async function killProcess(pid: string) {
    try {
      await api(`/api/servers/${srv!.id}/kill`, { method: 'POST', body: JSON.stringify({ pid }) });
      showToast(`Process ${pid} killed`, 'success');
      setKillConfirm(null);
      loadTabData();
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function serviceAction(name: string, action: string) {
    try {
      await api(`/api/servers/${srv!.id}/services/${name}/${action}`, { method: 'POST' });
      showToast(`${action} ${name} executed`, 'success');
      setTimeout(loadTabData, 2000);
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function viewTableData(dbType: string, dbName: string, table: string) {
    setLoading(true);
    try {
      const data = await api(`/api/servers/${srv!.id}/db/data?dbType=${dbType}&dbName=${dbName}&table=${table}`);
      // Parse raw CSV-ish output
      const lines = data.raw.trim().split('\n');
      if (lines.length > 0) {
        const columns = lines[0].split('\t'); // MySQL -B uses tabs
        const rows = lines.slice(1).map((l: string) => {
          const vals = l.split('\t');
          const obj: any = {};
          columns.forEach((col: string, i: number) => obj[col] = vals[i]);
          return obj;
        });
        setDbData({ table, columns, rows, dbType, dbName });
      } else {
        setDbData({ table, columns: [], rows: [], dbType, dbName });
      }
    } catch (e: any) { showToast(e.message, 'error'); }
    setLoading(false);
  }

  async function updateRecord(dbType: string, dbName: string, table: string, pkCol: string, pkVal: any, currentData: any) {
    const newDataStr = prompt('Edit record JSON:', JSON.stringify(currentData));
    if (!newDataStr) return;
    try {
      const data = JSON.parse(newDataStr);
      await api(`/api/servers/${srv!.id}/db/data/update`, {
        method: 'POST',
        body: JSON.stringify({ dbType, dbName, table, pkCol, pkVal, data })
      });
      showToast('Record updated', 'success');
      viewTableData(dbType, dbName, table);
    } catch (e: any) { showToast('Invalid JSON or update error', 'error'); }
  }

  if (!srv) return <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>Server not found</div>;

  const sortedProcesses = [...processes].sort((a, b) =>
    processSort === 'cpu' ? parseFloat(b.cpu) - parseFloat(a.cpu) : parseFloat(b.mem) - parseFloat(a.mem)
  );

  const detailTabs: { key: DetailTab; label: string; icon: any }[] = [
    { key: 'processes', label: 'Processes', icon: Activity },
    { key: 'services', label: 'Services', icon: Plug },
    { key: 'connections', label: 'Network', icon: Wifi },
    { key: 'logs', label: 'Logs', icon: ScrollText },
    { key: 'hardware', label: 'Hardware', icon: Thermometer },
    { key: 'files', label: 'Files', icon: FolderOpen },
    { key: 'sites', label: 'Sites & Apps', icon: Globe },
    { key: 'database', label: 'Database', icon: HardDrive },
    { key: 'cron', label: 'Cron Jobs', icon: Clock },
    { key: 'performance', label: 'Performance', icon: Activity },
    { key: 'security', label: 'Security', icon: ShieldCheck },
    { key: 'software', label: 'Software', icon: Cpu },
    { key: 'git', label: 'Git/Webhooks', icon: GitBranch },
    { key: 'users', label: 'Sub-Accounts', icon: Users },
    { key: 'waf', label: 'WAF', icon: Shield },
    { key: 'terminal', label: 'Terminal', icon: TerminalSquare },
  ];

  async function navigateTo(path: string) {
    setFilePath(path);
    setFileContent(null);
    try {
      const data = await api(`/api/servers/${srv!.id}/files?path=${encodeURIComponent(path)}`);
      setFileEntries(data.entries || []);
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function viewFile(path: string) {
    try {
      const data = await api(`/api/servers/${srv!.id}/file-content?path=${encodeURIComponent(path)}`);
      setFileContent({ content: data.content, path });
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' K';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' M';
    return (bytes / 1073741824).toFixed(1) + ' G';
  }



  async function uploadToB2(filename: string) {
    try {
      const baseName = filename.split('/').pop() || filename;
      showToast(`Uploading ${baseName} to Backblaze...`, 'info');
      const data = await api(`/api/servers/${srv!.id}/backups/upload`, {
        method: 'POST', body: JSON.stringify({ filename }),
      });
      if (data.success) {
        showToast(`Successfully uploaded to B2: ${data.b2Path}`, 'success');
      } else {
        showToast(`Upload failed: ${data.error}`, 'error');
      }
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  function parseHardware(raw: string) {
    const sections: Record<string, string> = {};
    const parts = raw.split(/===(\w+)===/);
    for (let i = 1; i < parts.length; i += 2) {
      sections[parts[i]] = parts[i + 1]?.trim() || '';
    }
    return sections;
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost" onClick={() => setPage('overview')} style={{ padding: '6px 10px' }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{srv.name}</h1>
          <p style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
            {srv.ip} · {srv.ssh_user}@{srv.ip}:{srv.ssh_port}
            {info && ` · ${info.hostname} · ${info.uptime}`}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={loadTabData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Info cards */}
      {info && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div className="glass-sm" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Hostname</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{info.hostname}</div>
          </div>
          <div className="glass-sm" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Cores</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{info.cores}</div>
          </div>
          <div className="glass-sm" style={{ padding: 16 }}>
            <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Uptime</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{info.uptime}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {detailTabs.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* PROCESSES */}
      {tab === 'processes' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Sort by:</span>
            <button className={`tab ${processSort === 'cpu' ? 'active' : ''}`} onClick={() => setProcessSort('cpu')} style={{ padding: '4px 10px', fontSize: 11 }}>CPU %</button>
            <button className={`tab ${processSort === 'mem' ? 'active' : ''}`} onClick={() => setProcessSort('mem')} style={{ padding: '4px 10px', fontSize: 11 }}>MEM %</button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{processes.length} processes</span>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>PID</th><th>User</th><th>CPU%</th><th>MEM%</th><th>Command</th><th></th></tr></thead>
              <tbody>
                {sortedProcesses.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.pid}</td>
                    <td>{p.user}</td>
                    <td>
                      <span style={{ color: parseFloat(p.cpu) > 50 ? '#ef4444' : parseFloat(p.cpu) > 10 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                        {p.cpu}%
                      </span>
                    </td>
                    <td>{p.mem}%</td>
                    <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontFamily: 'monospace' }}>{p.command}</td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => setKillConfirm(p.pid)}>
                        <Trash2 size={10} /> Kill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SERVICES */}
      {tab === 'services' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Service</th><th>Load</th><th>Active</th><th>Sub</th><th>Description</th><th>Actions</th></tr></thead>
              <tbody>
                {services.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{s.unit}</td>
                    <td><span className="metric-badge" style={{ background: s.load === 'loaded' ? 'rgba(34,197,94,0.15)' : 'rgba(100,100,100,0.15)', color: s.load === 'loaded' ? '#86efac' : '#94a3b8' }}>{s.load}</span></td>
                    <td><span className="metric-badge" style={{ background: s.active === 'active' ? 'rgba(34,197,94,0.15)' : s.active === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(100,100,100,0.15)', color: s.active === 'active' ? '#86efac' : s.active === 'failed' ? '#fca5a5' : '#94a3b8' }}>{s.active}</span></td>
                    <td style={{ fontSize: 11 }}>{s.sub}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{s.description}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => serviceAction(s.unit, 'restart')} title="Restart">
                          <RotateCw size={10} />
                        </button>
                        {s.active === 'active' ? (
                          <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => serviceAction(s.unit, 'stop')} title="Stop">
                            <Square size={10} />
                          </button>
                        ) : (
                          <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => serviceAction(s.unit, 'start')} title="Start">
                            <Play size={10} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONNECTIONS */}
      {tab === 'connections' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Proto</th><th>State</th><th>Local Address</th><th>Remote Address</th><th>Process</th></tr></thead>
              <tbody>
                {connections.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.protocol}</td>
                    <td><span className="metric-badge" style={{ background: c.state === 'ESTAB' ? 'rgba(34,197,94,0.15)' : c.state === 'LISTEN' ? 'rgba(99,102,241,0.15)' : 'rgba(100,100,100,0.15)', color: c.state === 'ESTAB' ? '#86efac' : c.state === 'LISTEN' ? '#a5b4fc' : '#94a3b8' }}>{c.state}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.local}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.remote}</td>
                    <td style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.process}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LOGS */}
      {tab === 'logs' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <input className="input" placeholder="Service name (e.g. nginx)" value={logService} onChange={e => setLogService(e.target.value)} style={{ flex: 1, minWidth: 150 }} />
            <input className="input" placeholder="Search keyword" value={logSearch} onChange={e => setLogSearch(e.target.value)} style={{ flex: 1, minWidth: 150 }} />
            <select className="input" value={logLines} onChange={e => setLogLines(e.target.value)} style={{ width: 100 }}>
              <option value="50">50 lines</option>
              <option value="100">100 lines</option>
              <option value="200">200 lines</option>
              <option value="500">500 lines</option>
            </select>
            <button className="btn btn-primary" onClick={loadTabData}>
              <RefreshCw size={12} /> Fetch Logs
            </button>
          </div>
          <div className="log-viewer">{logs || 'Press "Fetch Logs" to load...'}</div>
        </div>
      )}

      {/* HARDWARE */}
      {tab === 'hardware' && (
        <div>
          {(() => {
            const sections = parseHardware(hardware);
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="glass-sm" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Thermometer size={14} /> Temperature
                  </h3>
                  <pre style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {sections.TEMP && sections.TEMP !== 'N/A'
                      ? sections.TEMP.split('\n').map((t: string) => `${(parseInt(t) / 1000).toFixed(1)}°C`).join('\n')
                      : 'Not available (cloud VM)'}
                  </pre>
                </div>
                <div className="glass-sm" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HardDrive size={14} /> Disks
                  </h3>
                  <pre style={{ fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                    {sections.DISKS || 'Not available'}
                  </pre>
                </div>
                <div className="glass-sm" style={{ padding: 20, gridColumn: 'span 2' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>Sensors / SMART Data</h3>
                  <pre style={{ fontSize: 11, color: '#e2e8f0', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                    {sections.SENSORS || 'Not available'}
                    {'\n\n'}
                    {sections.SMART || ''}
                  </pre>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* FILES */}
      {tab === 'files' && (
        <div>
          {/* Breadcrumb */}
          <div className="glass-sm" style={{ padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {filePath.split('/').filter(Boolean).map((part, i, arr) => {
              const path = '/' + arr.slice(0, i + 1).join('/');
              return (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ChevronRight size={10} style={{ color: '#475569' }} />
                  <button onClick={() => navigateTo(path)} style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 12, fontFamily: 'monospace' }}>{part}</button>
                </span>
              );
            })}
            <button onClick={() => navigateTo('/')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 11, marginLeft: 'auto' }}>/root</button>
          </div>

          {/* File Actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => {
              setModal({ type: 'input', data: { 
                title: 'New Folder', 
                placeholder: 'Folder name', 
                onSave: async (val: string) => {
                  await api(`/api/servers/${srv.id}/files/mkdir`, { method: 'POST', body: JSON.stringify({ path: `${filePath}/${val}` }) });
                  loadTabData();
                } 
              }});
            }}>
              <Plus size={12} /> New Folder
            </button>
          </div>

          {/* File viewer/editor overlay */}
          {fileContent && (
            <div style={{ marginBottom: 12 }}>
              <div className="glass" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 600, fontFamily: 'monospace' }}>{fileContent.path}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11 }} onClick={async () => {
                      try {
                        await api(`/api/servers/${srv.id}/files/save`, { method: 'POST', body: JSON.stringify({ path: fileContent.path, content: fileContent.content }) });
                        showToast('File saved successfully', 'success');
                      } catch (e: any) { showToast(e.message, 'error'); }
                    }}>
                      <Save size={12} /> Save
                    </button>
                    <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => setFileContent(null)}>Close</button>
                  </div>
                </div>
                <textarea
                  value={fileContent.content}
                  onChange={e => setFileContent({ ...fileContent, content: e.target.value })}
                  style={{ width: '100%', height: 400, background: '#0a0e1a', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Directory listing */}
          <div className="glass" style={{ overflow: 'hidden' }}>
            {filePath !== '/' && (
              <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(99,120,195,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}
                onClick={() => navigateTo(filePath.split('/').slice(0, -1).join('/') || '/')}>
                <FolderOpen size={14} /> ..
              </div>
            )}
            {fileEntries.map((entry: any, i: number) => (
              <div key={i} style={{ padding: '8px 16px', borderBottom: '1px solid rgba(99,120,195,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => entry.isDir ? navigateTo(filePath === '/' ? `/${entry.name}` : `${filePath}/${entry.name}`) : viewFile(filePath === '/' ? `/${entry.name}` : `${filePath}/${entry.name}`)}>
                  {entry.isDir ? <FolderOpen size={14} color="#f59e0b" /> : <File size={14} color="#64748b" />}
                  <span style={{ flex: 1, color: entry.isDir ? '#fbbf24' : '#e2e8f0', fontFamily: 'monospace' }}>
                    {entry.name}{entry.isLink ? ` → ${entry.linkTarget}` : ''}
                  </span>
                  <span style={{ color: '#475569', fontSize: 10 }}>{entry.perms}</span>
                  <span style={{ color: '#475569', fontSize: 10, minWidth: 50, textAlign: 'right' }}>{!entry.isDir ? formatSize(entry.size) : ''}</span>
                  <span style={{ color: '#475569', fontSize: 10 }}>{entry.date}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!entry.isDir && <button onClick={() => viewFile(filePath === '/' ? `/${entry.name}` : `${filePath}/${entry.name}`)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Eye size={12} color="#64748b" /></button>}
                  <button onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${entry.name}?`)) {
                      await api(`/api/servers/${srv.id}/files/delete`, { method: 'POST', body: JSON.stringify({ path: filePath === '/' ? `/${entry.name}` : `${filePath}/${entry.name}` }) });
                      loadTabData();
                    }
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={12} color="#ef4444" />
                  </button>
                </div>
              </div>
            ))}
            {fileEntries.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Empty directory</div>}
          </div>
        </div>
      )}

      {/* SITES & APPS */}
      {tab === 'sites' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(sites).map(([name, content]) => (
              <div key={name} className="glass">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Globe size={14} color="#6366f1" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>{name}</span>
                  <button className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={async () => {
                     if (confirm(`Delete website ${name}?`)) {
                       await api(`/api/servers/${srv.id}/sites/delete`, { method: 'POST', body: JSON.stringify({ domain: name }) });
                       showToast('Website deleted', 'success');
                       loadTabData();
                     }
                   }}><Trash2 size={12} color="#ef4444" /></button>
                </div>
                <pre className="log-viewer" style={{ fontSize: 11, margin: 0, borderRadius: 0 }}>{content}</pre>
              </div>
            ))}
          </div>

          <div className="glass" style={{ height: 'fit-content' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>
              Add New Website
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Domain</div>
                <input id="site-domain" placeholder="example.com" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
              </div>
              {siteType !== 'proxy' ? (
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Document Root</div>
                  <input id="site-root" placeholder="/var/www/html/mysite" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Backend Port</div>
                  <input id="site-port" type="number" placeholder="3000" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Type</div>
                <select 
                  id="site-type" 
                  value={siteType}
                  onChange={e => setSiteType(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }}
                >
                  <option value="static">Static HTML</option>
                  <option value="php">PHP-FPM</option>
                  <option value="proxy">Reverse Proxy</option>
                </select>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={async () => {
                const domain = (document.getElementById('site-domain') as HTMLInputElement).value;
                const root = siteType !== 'proxy' ? (document.getElementById('site-root') as HTMLInputElement).value : '/dev/null';
                const port = siteType === 'proxy' ? (document.getElementById('site-port') as HTMLInputElement).value : '';
                const type = siteType;
                if (!domain || (!root && type !== 'proxy')) return;
                try {
                  await api(`/api/servers/${srv.id}/sites/add`, { method: 'POST', body: JSON.stringify({ domain, root, type, port }) });
                  showToast('Website added successfully', 'success');
                  loadTabData();
                } catch (e: any) { showToast(e.message, 'error'); }
              }}>Create Website</button>
            </div>
          </div>
        </div>
      )}

      {/* DATABASE TAB */}
      {tab === 'database' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Database Info Sections */}
            {Object.entries(dbInfo).map(([name, content]) => (
              <div key={name} className="glass">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{name.toUpperCase()} Databases</span>
                </div>
                <div style={{ padding: 16 }}>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {content.split('\n').filter(l => l.trim() && !l.includes('Database') && !l.includes('--')).map((db, i) => (
                        <div key={i} className="glass-sm" style={{ padding: '8px 12px' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#a5b4fc' }}>{db.trim()}</span>
                              <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={async () => {
                                 const res = await api(`/api/servers/${srv!.id}/db/tables`, { method: 'POST', body: JSON.stringify({ dbType: name, dbName: db.trim() }) });
                                 setModal({ type: 'tables', data: { dbName: db.trim(), output: res.output } });
                              }}>List Tables</button>
                           </div>
                           <div style={{ fontSize: 11, color: '#64748b' }}>
                              Quick Actions: 
                              <button style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 11, cursor: 'pointer', marginLeft: 8 }} onClick={() => {
                                 setModal({ type: 'input', data: { 
                                   title: 'Browse Table', 
                                   placeholder: 'Table name', 
                                   onSave: (val: string) => viewTableData(name, db.trim(), val) 
                                 }});
                              }}>Browse Table</button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            ))}

            {dbData && (
              <div className="glass animate-fadeIn" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HardDrive size={14} color="#6366f1" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Table: {dbData.table}</span>
                  </div>
                  <button className="btn btn-ghost" onClick={() => setDbData(null)}>Close</button>
                </div>
                <div style={{ maxHeight: 400, overflow: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {dbData.columns.map(col => <th key={col}>{col}</th>)}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbData.rows.map((row, i) => (
                        <tr key={i}>
                          {dbData.columns.map(col => <td key={col} style={{ fontSize: 11, color: '#e2e8f0' }}>{row[col]}</td>)}
                          <td>
                             <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 4px' }} onClick={() => {
                                const pk = dbData.columns.find(c => c.toLowerCase().includes('id')) || dbData.columns[0];
                                setModal({ type: 'edit-record', data: { dbType: dbData.dbType, dbName: dbData.dbName, table: dbData.table, pkCol: pk, pkVal: row[pk], data: row } });
                             }}>Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Backups Section */}
            <div className="glass">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <HardDrive size={16} color="#6366f1" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>Recent Local Backups</span>
                <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => {
                  setModal({ type: 'input', data: { 
                    title: 'New MySQL Backup', 
                    placeholder: 'Database name', 
                    onSave: async (val: string) => {
                      setBackupRunning(true);
                      try {
                        await api(`/api/servers/${srv.id}/backup`, { method: 'POST', body: JSON.stringify({ type: 'mysql', dbName: val }) });
                        showToast('Backup completed', 'success');
                        loadTabData();
                      } catch (e: any) { showToast(e.message, 'error'); }
                      setBackupRunning(false);
                    } 
                  }});
                }} disabled={backupRunning}>
                  {backupRunning ? 'Running...' : 'New MySQL Backup'}
                </button>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {backups && backups.split('\n').filter(l => l.includes('backup-')).map((line, i) => {
                    const parts = line.trim().split(/\s+/);
                    const fname = parts[parts.length - 1];
                    const fullPath = fname.startsWith('/') ? fname : `/tmp/${fname}`;
                    return (
                      <div key={i} className="glass-sm" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <File size={12} color="#64748b" />
                        <span style={{ fontSize: 11, fontFamily: 'monospace', flex: 1, color: '#e2e8f0' }}>{fname}</span>
                        <span style={{ fontSize: 10, color: '#475569' }}>{parts[4]}</span>
                        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10, color: '#818cf8' }} onClick={() => uploadToB2(fullPath)}>
                          <UploadCloud size={11} /> Push to B2
                        </button>
                      </div>
                    );
                  })}
                  {(!backups || !backups.includes('backup-')) && (
                    <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>No backups found</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="glass">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>
                Create Database
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <select id="new-db-type" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }}>
                  <option value="mysql">MySQL</option>
                  <option value="postgres">PostgreSQL</option>
                </select>
                <input id="new-db-name" placeholder="Database Name" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                <button className="btn btn-primary" onClick={async () => {
                  const dbType = (document.getElementById('new-db-type') as HTMLSelectElement).value;
                  const dbName = (document.getElementById('new-db-name') as HTMLInputElement).value;
                  if (!dbName) return;
                  try {
                    await api(`/api/servers/${srv.id}/db/create`, { method: 'POST', body: JSON.stringify({ dbType, dbName }) });
                    showToast('Database created', 'success');
                    loadTabData();
                  } catch (e: any) { showToast(e.message, 'error'); }
                }}>Create DB</button>
              </div>
            </div>

            <div className="glass">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>
                Add DB User
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input id="db-u-name" placeholder="Username" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                <input id="db-u-pass" type="password" placeholder="Password" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                <input id="db-u-target" placeholder="Target Database" style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }} />
                <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={async () => {
                  const username = (document.getElementById('db-u-name') as HTMLInputElement).value;
                  const password = (document.getElementById('db-u-pass') as HTMLInputElement).value;
                  const dbName = (document.getElementById('db-u-target') as HTMLInputElement).value;
                  const dbType = (document.getElementById('new-db-type') as HTMLSelectElement).value;
                  if (!username || !password || !dbName) return;
                  try {
                    await api(`/api/servers/${srv.id}/db/user/create`, { method: 'POST', body: JSON.stringify({ dbType, dbName, username, password }) });
                    showToast('Database user created', 'success');
                  } catch (e: any) { showToast(e.message, 'error'); }
                }}>Add User</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TERMINAL TAB */}
      {tab === 'terminal' && srv && (
        <Terminal serverId={srv.id} serverName={srv.name} />
      )}

      {/* CRON JOBS TAB */}
      {tab === 'cron' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(99,120,195,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={14} color="#6366f1" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>Scheduled Cron Jobs</span>
            <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => setShowCronForm(f => !f)}>
              <Plus size={12} /> Add Job
            </button>
          </div>

          {showCronForm && (
            <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.08)', background: 'rgba(99,102,241,0.04)' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12, fontFamily: 'monospace' }}>
                Schedule format: <span style={{ color: '#a5b4fc' }}>minute hour day month weekday</span> &nbsp;|&nbsp;
                <span style={{ color: '#94a3b8' }}>Use * for every unit &nbsp;·&nbsp; Examples: <span style={{ color: '#a5b4fc' }}>0 2 * * *</span> = daily 2am,  <span style={{ color: '#a5b4fc' }}>*/5 * * * *</span> = every 5min</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 70px) 1fr auto', gap: 8, alignItems: 'end' }}>
                {(['minute','hour','day','month','weekday'] as const).map(field => (
                  <div key={field}>
                    <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'capitalize' }}>{field}</div>
                    <input
                      value={newCron[field]}
                      onChange={e => setNewCron(p => ({ ...p, [field]: e.target.value }))}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '6px 8px', color: '#f1f5f9', fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
                      placeholder="*"
                    />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Command</div>
                  <input
                    value={newCron.command}
                    onChange={e => setNewCron(p => ({ ...p, command: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '6px 10px', color: '#f1f5f9', fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
                    placeholder="/usr/bin/php /var/www/artisan schedule:run"
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: 12 }}
                  onClick={async () => {
                    if (!newCron.command) return showToast('Enter a command', 'error');
                    try {
                      await api(`/api/servers/${srv!.id}/crons`, { method: 'POST', body: JSON.stringify(newCron) });
                      showToast('Cron job added', 'success');
                      setNewCron({ minute: '*', hour: '*', day: '*', month: '*', weekday: '*', command: '' });
                      setShowCronForm(false);
                      const data = await api(`/api/servers/${srv!.id}/crons`);
                      setCrons(data.crons || []);
                    } catch (e: any) { showToast(e.message, 'error'); }
                  }}
                >Save</button>
              </div>
            </div>
          )}

          {crons.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              <Clock size={28} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
              No cron jobs scheduled. Click "Add Job" to create one.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Minute</th><th>Hour</th><th>Day</th><th>Month</th><th>Weekday</th><th>Command</th><th></th></tr></thead>
                <tbody>
                  {crons.map((c: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{c.minute}</td>
                      <td style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{c.hour}</td>
                      <td style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{c.day}</td>
                      <td style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{c.month}</td>
                      <td style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{c.weekday}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.command}</td>
                      <td>
                        <button className="btn btn-danger" style={{ padding: '2px 8px', fontSize: 10 }}
                          onClick={async () => {
                            try {
                              await api(`/api/servers/${srv!.id}/crons`, { method: 'DELETE', body: JSON.stringify({ raw: c.raw }) });
                              showToast('Cron job deleted', 'success');
                              setCrons(prev => prev.filter((_, idx) => idx !== i));
                            } catch (e: any) { showToast(e.message, 'error'); }
                          }}>
                          <X size={10} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PERFORMANCE TAB */}
      {tab === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {['1h', '6h', '24h', '7d'].map(r => (
              <button key={r} className={`tab ${metricRange === r ? 'active' : ''}`} onClick={() => setMetricRange(r)} style={{ padding: '4px 12px', fontSize: 11 }}>{r}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
            {/* CPU Chart */}
            <div className="glass" style={{ padding: 20, height: 300 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} color="#6366f1" /> CPU Usage (%)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricHistory}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={[0, 100]} stroke="#475569" fontSize={10} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 8, fontSize: 11 }}
                    itemStyle={{ color: '#818cf8' }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Area type="monotone" dataKey="cpu_percent" stroke="#6366f1" fillOpacity={1} fill="url(#colorCpu)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Memory Chart */}
            <div className="glass" style={{ padding: 20, height: 300 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardDrive size={14} color="#22c55e" /> Memory Usage (MB)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metricHistory}>
                  <defs>
                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis stroke="#475569" fontSize={10} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 8, fontSize: 11 }}
                    itemStyle={{ color: '#4ade80' }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Area type="monotone" dataKey="mem_used" stroke="#22c55e" fillOpacity={1} fill="url(#colorMem)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Network Chart */}
            <div className="glass" style={{ padding: 20, height: 300, gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wifi size={14} color="#f59e0b" /> Network Traffic (bps)
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metricHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis stroke="#475569" fontSize={10} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 8, fontSize: 11 }}
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                  />
                  <Line type="monotone" dataKey="rx_bps" name="Download" stroke="#f59e0b" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="tx_bps" name="Upload" stroke="#ef4444" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY TAB */}
      {tab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20 }}>
          <div className="glass">
            <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} color="#6366f1" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Firewall Rules (UFW)</span>
            </div>
            <div style={{ padding: 16 }}>
              <pre className="log-viewer" style={{ fontSize: 11 }}>{firewall}</pre>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <input id="fw-port" placeholder="Port (e.g. 80)" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '6px 12px', color: '#f1f5f9', fontSize: 12, flex: 1, outline: 'none' }} />
                <button className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12 }} onClick={async () => {
                  const port = (document.getElementById('fw-port') as HTMLInputElement).value;
                  if (!port) return;
                  await api(`/api/servers/${srv.id}/firewall/rule`, { method: 'POST', body: JSON.stringify({ action: 'allow', port }) });
                  const data = await api(`/api/servers/${srv.id}/firewall`);
                  setFirewall(data.output || '');
                }}>Allow</button>
                <button className="btn btn-danger" style={{ padding: '6px 16px', fontSize: 12 }} onClick={async () => {
                  const port = (document.getElementById('fw-port') as HTMLInputElement).value;
                  if (!port) return;
                  await api(`/api/servers/${srv.id}/firewall/rule`, { method: 'POST', body: JSON.stringify({ action: 'deny', port }) });
                  const data = await api(`/api/servers/${srv.id}/firewall`);
                  setFirewall(data.output || '');
                }}>Deny</button>
              </div>
            </div>
          </div>

          <div className="glass">
            <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} color="#a855f7" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>SSL Certificates (Certbot)</span>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Domain Name</div>
                <input
                  value={sslDomain}
                  onChange={e => setSslDomain(e.target.value)}
                  placeholder="example.com"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Email (for Let's Encrypt)</div>
                <input
                  value={sslEmail}
                  onChange={e => setSslEmail(e.target.value)}
                  placeholder="admin@example.com"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,120,195,0.2)', borderRadius: 6, padding: '8px 12px', color: '#f1f5f9', fontSize: 12, outline: 'none' }}
                />
              </div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={async () => {
                if (!sslDomain || !sslEmail) return showToast('Domain and Email required', 'error');
                showToast('Issuing certificate... this may take a minute', 'info');
                try {
                  const data = await api(`/api/servers/${srv.id}/ssl/issue`, { method: 'POST', body: JSON.stringify({ domain: sslDomain, email: sslEmail }) });
                  setModal({ type: 'json', data: { title: 'SSL Process Log', output: data.output } });
                  showToast('SSL Issue process completed', 'success');
                } catch (e: any) { showToast(e.message, 'error'); }
              }}>Issue Certificate</button>
            </div>
          </div>
        </div>
      )}

      {/* SOFTWARE TAB */}
      {tab === 'software' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {['nginx', 'mysql-server', 'postgresql', 'php-fpm', 'docker.io', 'git', 'certbot', 'redis-server', 'nodejs', 'pm2', 'fail2ban', 'htop', 'ufw'].map(pkg => {
            const isInstalled = softwareStatus[pkg] === 'installed';
            return (
              <div key={pkg} className="glass" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Cpu size={16} color="#6366f1" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', textTransform: 'capitalize' }}>{pkg.replace('-server', '').replace('.io', '')}</span>
                  </div>
                  <span className="metric-badge" style={{ background: isInstalled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: isInstalled ? '#86efac' : '#fca5a5' }}>
                    {isInstalled ? 'Installed' : 'Missing'}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: '#64748b' }}>
                  {pkg === 'nginx' ? 'High-performance web server and reverse proxy.' :
                   pkg === 'mysql-server' ? 'The world\'s most popular open-source database.' :
                   pkg === 'postgresql' ? 'Advanced open-source relational database.' :
                   pkg === 'php-fpm' ? 'PHP FastCGI Process Manager.' :
                   pkg === 'docker.io' ? 'Containerization platform for modern apps.' :
                   pkg === 'git' ? 'Distributed version control system.' :
                   pkg === 'certbot' ? 'Tool for automated SSL/TLS certificates.' :
                   pkg === 'redis-server' ? 'In-memory data structure store.' :
                   pkg === 'nodejs' ? 'JavaScript runtime for server-side apps.' :
                   pkg === 'pm2' ? 'Production process manager for Node.js.' : 
                   pkg === 'fail2ban' ? 'Intrusion prevention software framework.' :
                   pkg === 'htop' ? 'Interactive system-monitor and process-viewer.' :
                   pkg === 'ufw' ? 'Uncomplicated Firewall for Linux.' : 'System utility package.'}
                </p>
                <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(99,120,195,0.05)' }}>
                  {!isInstalled ? (
                    <button className="btn btn-primary" style={{ width: '100%', fontSize: 11, padding: '6px' }} onClick={async () => {
                      showToast(`Installing ${pkg}... this may take a few minutes`, 'info');
                      try {
                        await api(`/api/servers/${srv.id}/software/install`, { method: 'POST', body: JSON.stringify({ name: pkg }) });
                        showToast(`${pkg} installed successfully`, 'success');
                        loadTabData();
                      } catch (e: any) { showToast(e.message, 'error'); }
                    }}>Install Package</button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" style={{ flex: 1, fontSize: 10, padding: '4px' }} disabled>Update</button>
                      <button className="btn btn-ghost" style={{ flex: 1, fontSize: 10, padding: '4px', color: '#ef4444' }}>Remove</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GIT / WEBHOOKS TAB */}
      {tab === 'git' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 20 }}>
          <div className="glass">
            <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>
              Configured Webhooks
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Branch</th><th>Path</th><th>URL</th><th></th></tr></thead>
                <tbody>
                  {gitHooks.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{h.name}</td>
                      <td><span className="metric-badge">{h.branch}</span></td>
                      <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{h.path}</td>
                      <td style={{ fontSize: 10, fontFamily: 'monospace', color: '#6366f1' }}>
                        {window.location.origin}/api/deploy/{h.secret}
                        <button style={{ background: 'none', border: 'none', color: '#818cf8', marginLeft: 6, cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/deploy/${h.secret}`); showToast('Copied to clipboard', 'success'); }}>Copy</button>
                      </td>
                      <td>
                        <button className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={async () => {
                           if (confirm('Delete webhook?')) {
                              await api(`/api/webhooks/${h.id}`, { method: 'DELETE' });
                              loadTabData();
                           }
                        }}><Trash2 size={12} color="#ef4444" /></button>
                      </td>
                    </tr>
                  ))}
                  {gitHooks.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No webhooks configured</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="glass">
            <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>Create Webhook</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
               <div>
                 <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Name</div>
                 <input id="wh-name" placeholder="My App Deployment" className="input" style={{ width: '100%' }} />
               </div>
               <div>
                 <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Local Path</div>
                 <input id="wh-path" placeholder="/var/www/myapp" className="input" style={{ width: '100%' }} />
               </div>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                 <div>
                   <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Branch</div>
                   <input id="wh-branch" placeholder="main" className="input" style={{ width: '100%' }} />
                 </div>
                 <div>
                   <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Post-Command</div>
                   <input id="wh-cmd" placeholder="npm run build" className="input" style={{ width: '100%' }} />
                 </div>
               </div>
               <button className="btn btn-primary" onClick={async () => {
                 const name = (document.getElementById('wh-name') as HTMLInputElement).value;
                 const path = (document.getElementById('wh-path') as HTMLInputElement).value;
                 const branch = (document.getElementById('wh-branch') as HTMLInputElement).value;
                 const post_command = (document.getElementById('wh-cmd') as HTMLInputElement).value;
                 if (!name || !path) return showToast('Name and Path required', 'error');
                 try {
                   await api(`/api/webhooks`, { method: 'POST', body: JSON.stringify({ server_id: srv.id, name, path, branch, post_command }) });
                   showToast('Webhook created', 'success');
                   loadTabData();
                 } catch (e: any) { showToast(e.message, 'error'); }
               }}>Create Webhook</button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ACCOUNTS TAB */}
      {tab === 'users' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20 }}>
          <div className="glass">
            <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>System Users</div>
            <table className="data-table">
              <thead><tr><th>Username</th><th>Role</th><th>Created</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td><span className="metric-badge">{u.role}</span></td>
                    <td style={{ fontSize: 11 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="glass">
             <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>Create Sub-Account</div>
             <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input id="u-name" placeholder="Username" className="input" />
                <input id="u-pass" type="password" placeholder="Password" className="input" />
                <select id="u-role" className="input">
                   <option value="user">User (Restricted)</option>
                   <option value="admin">Admin (Full Access)</option>
                </select>
                <button className="btn btn-primary" onClick={async () => {
                  const username = (document.getElementById('u-name') as HTMLInputElement).value;
                  const password = (document.getElementById('u-pass') as HTMLInputElement).value;
                  const role = (document.getElementById('u-role') as HTMLSelectElement).value;
                  if (!username || !password) return showToast('Username and Password required', 'error');
                  try {
                    await api(`/api/users`, { method: 'POST', body: JSON.stringify({ username, password, role }) });
                    showToast('User created', 'success');
                    loadTabData();
                  } catch (e: any) { showToast(e.message, 'error'); }
                }}>Add User</button>
             </div>
          </div>
        </div>
      )}

      {/* WAF TAB */}
      {tab === 'waf' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 20 }}>
          <div className="glass">
            <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color="#6366f1" />
              <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Web Application Firewall (Nginx)</span>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { id: 'basic_waf', title: 'Global Attack Protection', desc: 'Blocks SQLi, XSS, and bad bots using common Nginx security patterns.' },
                ].map(rule => {
                  const isActive = wafRules.includes(rule.id);
                  return (
                    <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: isActive ? 'rgba(99,102,241,0.05)' : 'rgba(255,255,255,0.02)', borderRadius: 12, border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(99,120,195,0.1)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>{rule.title}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{rule.desc}</div>
                      </div>
                      <div 
                        style={{ width: 44, height: 22, background: isActive ? '#6366f1' : '#1e293b', borderRadius: 20, position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }} 
                        onClick={async () => {
                          const newStatus = !isActive;
                          try {
                            await api(`/api/servers/${srv.id}/waf/toggle`, { method: 'POST', body: JSON.stringify({ enabled: newStatus }) });
                            showToast(`WAF ${newStatus ? 'Enabled' : 'Disabled'}`, 'success');
                            loadTabData();
                          } catch (e: any) { showToast(e.message, 'error'); }
                        }}
                      >
                         <div style={{ width: 18, height: 18, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: isActive ? 24 : 2, transition: 'all 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="glass">
            <div style={{ padding: 16, borderBottom: '1px solid rgba(99,120,195,0.1)', fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>Global WAF Status</div>
            <div style={{ padding: 24, textAlign: 'center' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Status</span>
                  <span className="metric-badge" style={{ background: wafRules.length > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: wafRules.length > 0 ? '#86efac' : '#fca5a5' }}>
                    {wafRules.length > 0 ? 'ACTIVE' : 'INACTIVE'}
                  </span>
               </div>
               <p style={{ fontSize: 11, color: '#64748b', marginBottom: 20, textAlign: 'left' }}>
                 When enabled, Nginx will block suspicious requests before they reach your application. Note: This applies to all sites hosted on this server.
               </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="glass animate-fadeIn" style={{ padding: 32, maxWidth: 600, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
                {modal.type === 'tables' && `Tables in ${modal.data.dbName}`}
                {modal.type === 'edit-record' && `Edit Record: ${modal.data.table}`}
                {modal.type === 'json' && modal.data.title}
                {modal.type === 'input' && modal.data.title}
              </h3>
              <button className="btn btn-ghost" onClick={() => setModal(null)}><X size={18} /></button>
            </div>

            {(modal.type === 'tables' || modal.type === 'json') && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 8, fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
                {modal.data.output}
              </div>
            )}

            {modal.type === 'input' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <input 
                  id="modal-input-field"
                  placeholder={modal.data.placeholder}
                  className="input"
                  style={{ width: '100%' }}
                  onKeyDown={e => { if (e.key === 'Enter') (document.getElementById('modal-save-btn') as any).click(); }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button id="modal-save-btn" className="btn btn-primary" onClick={async () => {
                    const val = (document.getElementById('modal-input-field') as HTMLInputElement).value;
                    if (!val) return;
                    await modal.data.onSave(val);
                    setModal(null);
                  }}>Confirm</button>
                </div>
              </div>
            )}

            {modal.type === 'edit-record' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Edit JSON below and click save.</div>
                <textarea 
                  defaultValue={JSON.stringify(modal.data.data, null, 2)}
                  id="record-json-editor"
                  style={{ width: '100%', height: 300, background: '#0a0e1a', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, fontSize: 12, fontFamily: 'monospace' }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={async () => {
                    const editor = document.getElementById('record-json-editor') as HTMLTextAreaElement;
                    try {
                      const newData = JSON.parse(editor.value);
                      const { dbType, dbName, table, pkCol, pkVal } = modal.data;
                      await api(`/api/servers/${srv!.id}/db/data/update`, {
                        method: 'POST',
                        body: JSON.stringify({ dbType, dbName, table, pkCol, pkVal, data: newData })
                      });
                      showToast('Record updated', 'success');
                      setModal(null);
                      viewTableData(dbType, dbName, table);
                    } catch (e) { showToast('Invalid JSON format', 'error'); }
                  }}>Save Changes</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kill confirm */}
      {killConfirm && (
        <div className="modal-overlay" onClick={() => setKillConfirm(null)}>
          <div className="glass animate-fadeIn" style={{ padding: 32, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Kill Process</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
              Are you sure you want to kill PID <strong style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{killConfirm}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setKillConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => killProcess(killConfirm)}>Kill Process</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
