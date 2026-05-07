import { useEffect, useState } from 'react';
import { useStore, api } from '../store';
import { Power, PowerOff, RotateCw, Camera, Trash2, HardDrive, Globe, Network, Scale, RefreshCw } from 'lucide-react';

type CloudTab = 'servers' | 'volumes' | 'snapshots' | 'ips' | 'networks' | 'balancers';

export default function CloudResources() {
  const { cloudServers, setCloudServers, showToast } = useStore();
  const [tab, setTab] = useState<CloudTab>('servers');
  const [volumes, setVolumes] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [floatingIps, setFloatingIps] = useState<any[]>([]);
  const [networks, setNetworks] = useState<any[]>([]);
  const [loadBalancers, setLoadBalancers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ action: string; id: number; name: string } | null>(null);
  const [snapshotModal, setSnapshotModal] = useState<{ serverId: number; serverName: string } | null>(null);
  const [snapshotDesc, setSnapshotDesc] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [srvRes, volRes, snapRes, ipRes, netRes, lbRes] = await Promise.all([
        api('/api/cloud/servers'),
        api('/api/cloud/volumes'),
        api('/api/cloud/snapshots'),
        api('/api/cloud/floating-ips'),
        api('/api/cloud/networks'),
        api('/api/cloud/load-balancers'),
      ]);
      setCloudServers(srvRes.servers || []);
      setVolumes(volRes.volumes || []);
      setSnapshots(snapRes.images || []);
      setFloatingIps(ipRes.floating_ips || []);
      setNetworks(netRes.networks || []);
      setLoadBalancers(lbRes.load_balancers || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function doAction(serverId: number, action: string) {
    try {
      await api(`/api/cloud/servers/${serverId}/actions/${action}`, { method: 'POST' });
      showToast(`Action '${action}' sent successfully`, 'success');
      setConfirm(null);
      setTimeout(loadAll, 3000);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  async function createSnapshot() {
    if (!snapshotModal) return;
    try {
      await api(`/api/cloud/servers/${snapshotModal.serverId}/snapshots`, {
        method: 'POST',
        body: JSON.stringify({ description: snapshotDesc || `Snapshot of ${snapshotModal.serverName}` }),
      });
      showToast('Snapshot creation started', 'success');
      setSnapshotModal(null);
      setSnapshotDesc('');
      setTimeout(loadAll, 5000);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  async function deleteSnapshot(id: number) {
    try {
      await api(`/api/cloud/snapshots/${id}`, { method: 'DELETE' });
      showToast('Snapshot deleted', 'success');
      loadAll();
    } catch (e: any) { showToast(e.message, 'error'); }
  }

  const tabs: { key: CloudTab; label: string; icon: any }[] = [
    { key: 'servers', label: 'Servers', icon: Power },
    { key: 'volumes', label: 'Volumes', icon: HardDrive },
    { key: 'snapshots', label: 'Snapshots', icon: Camera },
    { key: 'ips', label: 'Floating IPs', icon: Globe },
    { key: 'networks', label: 'Networks', icon: Network },
    { key: 'balancers', label: 'Load Balancers', icon: Scale },
  ];

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>Cloud Resources</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Manage your Hetzner Cloud infrastructure</p>
        </div>
        <button className="btn btn-ghost" onClick={loadAll} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <t.icon size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Servers */}
      {tab === 'servers' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr>
              <th>Name</th><th>Status</th><th>Type</th><th>Location</th><th>IPv4</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {cloudServers.map((srv: any) => (
                <tr key={srv.id}>
                  <td style={{ fontWeight: 600 }}>{srv.name}</td>
                  <td>
                    <span className="metric-badge" style={{
                      background: srv.status === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: srv.status === 'running' ? '#86efac' : '#fca5a5',
                    }}>{srv.status}</span>
                  </td>
                  <td>{srv.server_type?.name}</td>
                  <td>{srv.datacenter?.location?.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{srv.public_net?.ipv4?.ip}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {srv.status === 'running' ? (
                        <>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => setConfirm({ action: 'poweroff', id: srv.id, name: srv.name })}>
                            <PowerOff size={12} /> Stop
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={() => setConfirm({ action: 'reboot', id: srv.id, name: srv.name })}>
                            <RotateCw size={12} /> Reboot
                          </button>
                        </>
                      ) : (
                        <button className="btn btn-success" style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => setConfirm({ action: 'poweron', id: srv.id, name: srv.name })}>
                          <Power size={12} /> Start
                        </button>
                      )}
                      <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => setSnapshotModal({ serverId: srv.id, serverName: srv.name })}>
                        <Camera size={12} /> Snapshot
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {cloudServers.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No cloud servers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Volumes */}
      {tab === 'volumes' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Size</th><th>Server</th><th>Location</th><th>Status</th></tr></thead>
            <tbody>
              {volumes.map((v: any) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td>{v.size} GB</td>
                  <td>{v.server ? `Server #${v.server}` : 'Detached'}</td>
                  <td>{v.location?.name}</td>
                  <td><span className="metric-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac' }}>{v.status}</span></td>
                </tr>
              ))}
              {volumes.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No volumes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Snapshots */}
      {tab === 'snapshots' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Description</th><th>Created From</th><th>Size</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {snapshots.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.description || 'Untitled'}</td>
                  <td>{s.created_from?.name || 'N/A'}</td>
                  <td>{s.image_size?.toFixed(1)} GB</td>
                  <td>{new Date(s.created).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={() => deleteSnapshot(s.id)}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
              {snapshots.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No snapshots</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating IPs */}
      {tab === 'ips' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>IP</th><th>Type</th><th>Server</th><th>Location</th></tr></thead>
            <tbody>
              {floatingIps.map((ip: any) => (
                <tr key={ip.id}>
                  <td style={{ fontFamily: 'monospace' }}>{ip.ip}</td>
                  <td>{ip.type}</td>
                  <td>{ip.server ? `Server #${ip.server}` : 'Unassigned'}</td>
                  <td>{ip.home_location?.name}</td>
                </tr>
              ))}
              {floatingIps.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No floating IPs</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Networks */}
      {tab === 'networks' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>IP Range</th><th>Servers</th></tr></thead>
            <tbody>
              {networks.map((n: any) => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 600 }}>{n.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{n.ip_range}</td>
                  <td>{n.servers?.length || 0}</td>
                </tr>
              ))}
              {networks.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No networks</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Load Balancers */}
      {tab === 'balancers' && (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>IPv4</th><th>Type</th><th>Location</th><th>Targets</th></tr></thead>
            <tbody>
              {loadBalancers.map((lb: any) => (
                <tr key={lb.id}>
                  <td style={{ fontWeight: 600 }}>{lb.name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{lb.public_net?.ipv4?.ip}</td>
                  <td>{lb.load_balancer_type?.name}</td>
                  <td>{lb.location?.name}</td>
                  <td>{lb.targets?.length || 0}</td>
                </tr>
              ))}
              {loadBalancers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>No load balancers</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Modal */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="glass animate-fadeIn" style={{ padding: 32, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Confirm Action</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
              Are you sure you want to <strong style={{ color: '#fbbf24' }}>{confirm.action}</strong> server <strong style={{ color: '#f1f5f9' }}>{confirm.name}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => doAction(confirm.id, confirm.action)}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Modal */}
      {snapshotModal && (
        <div className="modal-overlay" onClick={() => setSnapshotModal(null)}>
          <div className="glass animate-fadeIn" style={{ padding: 32, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>Create Snapshot</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
              Creating snapshot of <strong style={{ color: '#f1f5f9' }}>{snapshotModal.serverName}</strong>
            </p>
            <input className="input" placeholder="Snapshot description (optional)" value={snapshotDesc} onChange={e => setSnapshotDesc(e.target.value)} style={{ marginBottom: 20 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setSnapshotModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={createSnapshot}>Create Snapshot</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
