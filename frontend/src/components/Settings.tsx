import { useState, useEffect } from 'react';
import { useStore, api } from '../store';
import { Plus, Trash2, Plug, Server } from 'lucide-react';

export default function SettingsPage() {
  const { servers, setServers, showToast } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [testing, setTesting] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const [delConfirm, setDelConfirm] = useState<number | null>(null);

  useEffect(() => { loadServers(); }, []);

  async function loadServers() {
    try {
      const data = await api('/api/servers');
      setServers(data.servers || []);
    } catch (e) { console.error(e); }
  }

  async function addServer(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name, ip, ssh_user: sshUser, ssh_password: sshPassword, ssh_port: parseInt(sshPort) }),
      });
      showToast('Server added successfully', 'success');
      setShowAdd(false);
      setName(''); setIp(''); setSshUser('root'); setSshPassword(''); setSshPort('22');
      loadServers();
    } catch (e: any) {
      showToast(e.message || 'Failed to add server', 'error');
    }
  }

  async function deleteServer(id: number) {
    try {
      await api(`/api/servers/${id}`, { method: 'DELETE' });
      showToast('Server removed', 'success');
      setDelConfirm(null);
      loadServers();
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  async function testConnection(id: number) {
    setTesting(id);
    try {
      const data = await api(`/api/servers/${id}/test`, { method: 'POST' });
      setTestResults({ ...testResults, [id]: { success: data.success, message: data.success ? 'Connected!' : data.error } });
    } catch (e: any) {
      setTestResults({ ...testResults, [id]: { success: false, message: e.message } });
    }
    setTesting(null);
  }

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>Server Management</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Add and manage your monitored servers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Server
        </button>
      </div>

      {/* Server list */}
      <div style={{ display: 'grid', gap: 12 }}>
        {servers.map(srv => (
          <div key={srv.id} className="glass" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #1e293b, #334155)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Server size={20} color="#94a3b8" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9' }}>{srv.name}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{srv.ssh_user}@{srv.ip}:{srv.ssh_port}</div>
            </div>
            {testResults[srv.id] && (
              <span className="metric-badge" style={{
                background: testResults[srv.id].success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: testResults[srv.id].success ? '#86efac' : '#fca5a5',
              }}>
                {testResults[srv.id].success ? '✓ Connected' : '✗ Failed'}
              </span>
            )}
            <button className="btn btn-ghost" onClick={() => testConnection(srv.id)} disabled={testing === srv.id}
              style={{ padding: '6px 12px', fontSize: 12 }}>
              <Plug size={12} /> {testing === srv.id ? 'Testing...' : 'Test'}
            </button>
            <button className="btn btn-ghost" onClick={() => setDelConfirm(srv.id)}
              style={{ padding: '6px 10px', color: '#ef4444' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {servers.length === 0 && (
          <div className="glass" style={{ padding: 48, textAlign: 'center' }}>
            <Server size={40} color="#334155" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>No servers configured yet.</p>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Your First Server
            </button>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <form onSubmit={addServer} className="glass animate-fadeIn" style={{ padding: 32, width: 440 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 }}>Add Server</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Display Name</label>
              <input className="input" placeholder="My Hetzner Server" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 4 }}>IP Address</label>
              <input className="input" placeholder="178.105.71.89" value={ip} onChange={e => setIp(e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 4 }}>SSH User</label>
                <input className="input" placeholder="root" value={sshUser} onChange={e => setSshUser(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 4 }}>SSH Port</label>
                <input className="input" type="number" placeholder="22" value={sshPort} onChange={e => setSshPort(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: 4 }}>SSH Password</label>
              <input className="input" type="password" placeholder="••••••••" value={sshPassword} onChange={e => setSshPassword(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Add Server</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirm */}
      {delConfirm && (
        <div className="modal-overlay" onClick={() => setDelConfirm(null)}>
          <div className="glass animate-fadeIn" style={{ padding: 32, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Remove Server</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>This will remove the server from monitoring. It will not affect the server itself.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDelConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteServer(delConfirm)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
