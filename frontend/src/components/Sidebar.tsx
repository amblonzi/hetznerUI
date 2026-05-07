import { useStore, type Page } from '../store';
import { Activity, Cloud, Settings, LogOut, Server, HardDrive } from 'lucide-react';

const navItems: { page: Page; label: string; icon: any }[] = [
  { page: 'overview', label: 'Overview', icon: Activity },
  { page: 'cloud', label: 'Hetzner Cloud', icon: Cloud },
  { page: 'storage', label: 'Backblaze B2', icon: HardDrive },
  { page: 'settings', label: 'Servers', icon: Settings },
];

export default function Sidebar() {
  const { currentPage, setPage, logout, username, servers } = useStore();

  return (
    <div style={{
      width: 240, minHeight: '100vh',
      background: 'linear-gradient(180deg, #0f1629 0%, #0a0e1a 100%)',
      borderRight: '1px solid rgba(99, 120, 195, 0.1)',
      display: 'flex', flexDirection: 'column',
      padding: '20px 12px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 32 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
        }}>
          <Server size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>Hetzner</div>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#6366f1', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Dashboard</div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', padding: '0 8px', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Navigation
        </div>
        {navItems.map(({ page, label, icon: Icon }) => (
          <button key={page} onClick={() => setPage(page)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 2, borderRadius: 10, border: 'none',
            cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s',
            background: currentPage === page ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
            color: currentPage === page ? '#a5b4fc' : '#94a3b8',
            borderLeft: currentPage === page ? '2px solid #6366f1' : '2px solid transparent',
          }}>
            <Icon size={16} />
            {label}
          </button>
        ))}

        {/* Managed servers list */}
        {servers.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', padding: '16px 8px 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Servers ({servers.length})
            </div>
            {servers.map(srv => (
              <button key={srv.id} onClick={() => useStore.getState().selectServer(srv.id)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', marginBottom: 1, borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 12, fontFamily: 'Inter, sans-serif',
                background: currentPage === 'server-detail' && useStore.getState().selectedServerId === srv.id ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                color: '#94a3b8',
              }}>
                <span className="status-dot running" />
                <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{srv.name}</span>
                <span style={{ fontSize: 10, color: '#475569' }}>{srv.ip.split('.').slice(-1)}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div style={{
        padding: '12px', borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #334155, #475569)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, color: '#e2e8f0',
        }}>
          {(username || 'A')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{username}</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>Admin</div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
