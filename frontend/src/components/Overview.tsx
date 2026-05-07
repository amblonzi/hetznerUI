import { useEffect, useState } from 'react';
import { useStore, api } from '../store';
import { Cpu, MemoryStick, HardDrive, RefreshCw } from 'lucide-react';

export default function Overview() {
  const { servers, metrics, setServers, cloudServers, setCloudServers, selectServer } = useStore();
  const [loading, setLoading] = useState(true);
  const [serverInfos, setServerInfos] = useState<Record<number, any>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [srvRes, cloudRes] = await Promise.all([
        api('/api/servers'),
        api('/api/cloud/servers'),
      ]);
      setServers(srvRes.servers || []);
      setCloudServers(cloudRes.servers || []);

      // Fetch info for each managed server
      const infos: Record<number, any> = {};
      for (const srv of (srvRes.servers || [])) {
        try {
          const info = await api(`/api/servers/${srv.id}/info`);
          infos[srv.id] = info;
        } catch { infos[srv.id] = null; }
      }
      setServerInfos(infos);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function parseMemory(memRaw: string) {
    const lines = memRaw.split('\n');
    const memLine = lines[1]?.trim().split(/\s+/);
    if (!memLine) return { total: 0, used: 0, pct: 0 };
    const total = parseInt(memLine[1]) || 1;
    const used = parseInt(memLine[2]) || 0;
    return { total, used, pct: Math.round((used / total) * 100) };
  }

  function parseDisk(dfRaw: string) {
    const lines = dfRaw.split('\n');
    const diskLine = lines[1]?.trim().split(/\s+/);
    if (!diskLine) return { total: '0', used: '0', pct: 0 };
    return { total: diskLine[1], used: diskLine[2], pct: parseInt(diskLine[4]) || 0 };
  }



  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>Server Overview</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            {servers.length} managed · {cloudServers.length} cloud
          </p>
        </div>
        <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Managed servers grid */}
      {servers.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Managed Servers
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginBottom: 32 }}>
            {servers.map(srv => {
              const info = serverInfos[srv.id];
              const mem = info ? parseMemory(info.memory || '') : null;
              const disk = info ? parseDisk(info.disk || '') : null;
              const liveMetrics = metrics[srv.ip];

              return (
                <div key={srv.id} className="glass" style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => selectServer(srv.id)}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(99,120,195,0.15)')}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <span className="status-dot running" />
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>{srv.name}</span>
                    <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{srv.ip}</span>
                  </div>

                  {info && (
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>
                      {info.hostname} · {info.cores} cores · {info.uptime}
                    </div>
                  )}

                  {/* CPU */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Cpu size={12} /> CPU
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#818cf8' }}>
                        {liveMetrics ? liveMetrics.cpu.toFixed(1) + '%' : 'N/A'}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${liveMetrics?.cpu || 0}%`,
                        background: `linear-gradient(90deg, #6366f1, ${(liveMetrics?.cpu || 0) > 80 ? '#ef4444' : '#818cf8'})`,
                      }} />
                    </div>
                  </div>

                  {/* Memory */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MemoryStick size={12} /> Memory
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#22c55e' }}>
                        {mem ? mem.pct + '%' : 'N/A'}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${mem?.pct || 0}%`,
                        background: `linear-gradient(90deg, #22c55e, ${(mem?.pct || 0) > 80 ? '#f59e0b' : '#4ade80'})`,
                      }} />
                    </div>
                  </div>

                  {/* Disk */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <HardDrive size={12} /> Disk
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>
                        {disk ? disk.pct + '%' : 'N/A'}
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${disk?.pct || 0}%`,
                        background: `linear-gradient(90deg, #f59e0b, ${(disk?.pct || 0) > 90 ? '#ef4444' : '#fbbf24'})`,
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Cloud servers */}
      {cloudServers.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Hetzner Cloud Servers
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {cloudServers.map((srv: any) => (
              <div key={srv.id} className="glass" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className={`status-dot ${srv.status === 'running' ? 'running' : 'stopped'}`} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', flex: 1 }}>{srv.name}</span>
                  <span className="metric-badge" style={{
                    background: srv.status === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: srv.status === 'running' ? '#86efac' : '#fca5a5',
                  }}>{srv.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: '#64748b' }}>Type:</span> <span style={{ color: '#e2e8f0' }}>{srv.server_type?.name}</span></div>
                  <div><span style={{ color: '#64748b' }}>Location:</span> <span style={{ color: '#e2e8f0' }}>{srv.datacenter?.location?.name}</span></div>
                  <div><span style={{ color: '#64748b' }}>IPv4:</span> <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{srv.public_net?.ipv4?.ip}</span></div>
                  <div><span style={{ color: '#64748b' }}>Cores:</span> <span style={{ color: '#e2e8f0' }}>{srv.server_type?.cores}</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {servers.length === 0 && cloudServers.length === 0 && !loading && (
        <div className="glass" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: 14 }}>No servers found. Add a server from the Settings page.</p>
        </div>
      )}
    </div>
  );
}
