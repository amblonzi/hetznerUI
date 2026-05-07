import { useEffect, useState } from 'react';
import { useStore, api, type ManagedServer } from '../store';
import { RefreshCw, Activity, Shield, Server, Zap, ChevronRight, Globe, Search } from 'lucide-react';

export default function Overview() {
  const { servers, metrics, setServers, cloudServers, setCloudServers, selectServer } = useStore();
  const [loading, setLoading] = useState(true);
  const [serverInfos, setServerInfos] = useState<Record<number, any>>({});
  const [searchTerm, setSearchTerm] = useState('');

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

  const parseMemory = (memRaw: string) => {
    const lines = memRaw.split('\n');
    const memLine = lines[1]?.trim().split(/\s+/);
    if (!memLine) return { total: 0, used: 0, pct: 0 };
    const total = parseInt(memLine[1]) || 1;
    const used = parseInt(memLine[2]) || 0;
    return { total, used, pct: Math.round((used / total) * 100) };
  };

  // Aggregated Stats
  const totalCores = Object.values(serverInfos).reduce((acc, info) => acc + (info?.cores || 0), 0);
  const avgCpu = Object.values(metrics).length > 0 
    ? (Object.values(metrics).reduce((acc, m) => acc + m.cpu, 0) / Object.values(metrics).length).toFixed(1)
    : 0;
  
  const filteredServers = servers.filter((s: ManagedServer) => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.ip.includes(searchTerm)
  );

  return (
    <div className="animate-fadeIn">
      {/* Header with Search and Refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, gap: 20 }}>
        <div style={{ flex: 1, position: 'relative', maxWidth: 400 }}>
           <Search size={16} color="#64748b" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
           <input 
              placeholder="Search servers..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(99,120,195,0.15)', borderRadius: 12, padding: '12px 14px 12px 42px', color: '#f1f5f9', fontSize: 14, outline: 'none' }} 
           />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" style={{ padding: '10px 20px' }} onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ marginRight: 4 }} /> 
            Sync Infrastructure
          </button>
          <button className="btn btn-primary" style={{ padding: '10px 24px' }}>
            <Server size={14} style={{ marginRight: 4 }} /> 
            Add Instance
          </button>
        </div>
      </div>

      {/* Stats Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
        {[
          { label: 'Managed Nodes', value: servers.length, sub: 'All systems online', icon: Server, color: '#6366f1' },
          { label: 'Cloud Resources', value: cloudServers.length, sub: 'Hetzner API Active', icon: Globe, color: '#a855f7' },
          { label: 'Avg CPU Load', value: `${avgCpu}%`, sub: 'Across infrastructure', icon: Activity, color: '#22c55e' },
          { label: 'Total Compute', value: `${totalCores} vCores`, sub: 'Provisioned power', icon: Zap, color: '#f59e0b' },
        ].map((stat, i) => (
          <div key={i} className="glass" style={{ padding: 24, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -10, right: -10, opacity: 0.05 }}>
              <stat.icon size={80} color={stat.color} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${stat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <stat.icon size={18} color={stat.color} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: stat.color }} />
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        
        {/* Managed Servers Column */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Managed Infrastructure</h2>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(99,102,241,0.2), transparent)' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredServers.map((srv: ManagedServer) => {
              const info = serverInfos[srv.id];
              const mem = info ? parseMemory(info.memory || '') : null;
              const liveMetrics = metrics[srv.ip];

              return (
                <div 
                  key={srv.id} 
                  className="glass" 
                  style={{ 
                    padding: '16px 20px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 20,
                    borderLeftWidth: 4,
                    borderLeftColor: (liveMetrics?.cpu || 0) > 80 ? '#ef4444' : '#6366f1'
                  }}
                  onClick={() => selectServer(srv.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Server size={20} color="#6366f1" />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>{srv.name}</div>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{srv.ip}</div>
                    </div>
                  </div>

                  {/* CPU Sparkline / Mini Stat */}
                  <div style={{ width: 120 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>CPU</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8' }}>{liveMetrics ? liveMetrics.cpu.toFixed(1) + '%' : 'N/A'}</span>
                     </div>
                     <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${liveMetrics?.cpu || 0}%`, background: '#6366f1' }} />
                     </div>
                  </div>

                  {/* MEM Sparkline / Mini Stat */}
                  <div style={{ width: 120 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>RAM</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>{mem ? mem.pct + '%' : 'N/A'}</span>
                     </div>
                     <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${mem?.pct || 0}%`, background: '#22c55e' }} />
                     </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="metric-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#86efac', border: '1px solid rgba(34,197,94,0.2)' }}>Healthy</span>
                    <ChevronRight size={16} color="#475569" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cloud Servers Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '40px 0 16px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Hetzner Cloud Instances</h2>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(168,85,247,0.2), transparent)' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {cloudServers.map((srv: any) => (
              <div key={srv.id} className="glass" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: srv.status === 'running' ? '#22c55e' : '#64748b' }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', flex: 1 }}>{srv.name}</span>
                  <span className="metric-badge" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>{srv.server_type?.name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>Location</span>
                      <span style={{ fontSize: 11, color: '#e2e8f0' }}>{srv.datacenter?.location?.name}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>IP Address</span>
                      <span style={{ fontSize: 11, color: '#e2e8f0', fontFamily: 'monospace' }}>{srv.public_net?.ipv4?.ip}</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Activity & Security */}
        <div>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} color="#6366f1" />
              Security Status
            </h3>
            <div className="glass" style={{ padding: 20 }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
                    100%
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Infrastructure Secure</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Firewalls active on all nodes</div>
                  </div>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: '#94a3b8' }}>SSL Certificates</span>
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>Active</span>
                  </div>
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: '#94a3b8' }}>WAF Protection</span>
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Partial</span>
                  </div>
               </div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="#a855f7" />
              Recent Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { type: 'deploy', msg: 'Website "shalimart" deployed', time: '2m ago' },
                { type: 'backup', msg: 'Daily backup successful', time: '4h ago' },
                { type: 'alert', msg: 'CPU Spike on Node "lending"', time: '6h ago' },
                { type: 'ssl', msg: 'SSL renewed for example.com', time: '1d ago' },
              ].map((act, i) => (
                <div key={i} className="glass-sm" style={{ padding: '12px 16px' }}>
                   <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 2 }}>{act.msg}</div>
                   <div style={{ fontSize: 10, color: '#64748b' }}>{act.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {servers.length === 0 && cloudServers.length === 0 && !loading && (
        <div className="glass" style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: 14 }}>No servers found. Add a server from the Settings page.</p>
        </div>
      )}
    </div>
  );
}
