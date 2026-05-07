import { useStore, type Page } from '../store';
import { Cloud, Settings, LogOut, Server, HardDrive, LayoutDashboard, ChevronRight } from 'lucide-react';

const navItems: { page: Page; label: string; icon: any }[] = [
  { page: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'cloud', label: 'Cloud Nodes', icon: Cloud },
  { page: 'storage', label: 'B2 Storage', icon: HardDrive },
  { page: 'settings', label: 'Inventory', icon: Settings },
];

export default function Sidebar() {
  const { currentPage, setPage, logout, username, servers } = useStore();

  return (
    <div style={{
      width: 260, minHeight: '100vh',
      background: 'rgba(10, 14, 26, 0.95)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(99, 120, 195, 0.1)',
      display: 'flex', flexDirection: 'column',
      padding: '24px 16px',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Glow Effect */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100px', background: 'radial-gradient(circle at top, rgba(99, 102, 241, 0.1), transparent)', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 8px', marginBottom: 40 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
        }}>
          <Server size={20} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Inphora</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.8 }}>Hetzner Panel</div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', padding: '0 12px', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Menu
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(({ page, label, icon: Icon }) => (
            <button key={page} onClick={() => setPage(page)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12, border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'Inter, sans-serif',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: currentPage === page ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              color: currentPage === page ? '#f1f5f9' : '#94a3b8',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {currentPage === page && (
                 <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: '#6366f1', borderRadius: '0 4px 4px 0' }} />
              )}
              <Icon size={18} style={{ opacity: currentPage === page ? 1 : 0.7 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
              {currentPage === page && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />}
            </button>
          ))}
        </div>

        {/* Managed servers list */}
        {servers.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', padding: '32px 12px 12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Connected Servers
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {servers.map(srv => (
                <button key={srv.id} onClick={() => useStore.getState().selectServer(srv.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10, border: 'none',
                  cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif',
                  transition: 'all 0.2s',
                  background: currentPage === 'server-detail' && useStore.getState().selectedServerId === srv.id ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  color: currentPage === 'server-detail' && useStore.getState().selectedServerId === srv.id ? '#f1f5f9' : '#64748b',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)' }} />
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{srv.name}</span>
                  <ChevronRight size={14} style={{ opacity: 0.3 }} />
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User & Version */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: '16px', borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #334155, #1e293b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {(username || 'A')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{username}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>System Administrator</div>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 8, borderRadius: 8, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={16} />
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#334155', fontWeight: 600, letterSpacing: '0.05em' }}>
          CORE v5.8.2 · PREMIUM
        </div>
      </div>
    </div>
  );
}
