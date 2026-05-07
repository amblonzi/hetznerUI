import { useState } from 'react';
import { useStore, api } from '../store';
import { Server, Lock, User, ChevronRight } from 'lucide-react';

export default function Login() {
  const { setAuth, showToast } = useStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (data.token) {
        setAuth(data.token, data.username);
        showToast('Welcome back!', 'success');
      } else {
        showToast(data.error || 'Login failed', 'error');
      }
    } catch {
      showToast('Connection failed', 'error');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0e1a',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Dynamic Background Elements */}
      <div style={{ position: 'absolute', top: '10%', left: '15%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, padding: 20, zIndex: 10 }}>
        <form onSubmit={handleLogin} className="glass animate-fadeIn" style={{ padding: '48px 40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          {/* Logo & Welcome */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{
              width: 64, height: 64, margin: '0 auto 24px',
              borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 12px 32px rgba(99, 102, 241, 0.4)',
              transform: 'rotate(-4deg)'
            }}>
              <Server size={32} color="white" />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em', marginBottom: 8 }}>Inphora Dashboard</h1>
            <p style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>Unified Server Management Infrastructure</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  className="input" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  placeholder="Username" 
                  style={{ paddingLeft: 42 }}
                  autoFocus 
                />
              </div>
            </div>

            <div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  className="input" 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="Password" 
                  style={{ paddingLeft: 42 }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width: '100%', height: 48, justifyContent: 'center', fontSize: 15, fontWeight: 700, marginTop: 12 }}>
              {loading ? 'Authenticating...' : (
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    Secure Sign In <ChevronRight size={18} />
                 </div>
              )}
            </button>
          </div>

          <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.03)', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: '#334155', fontWeight: 600, letterSpacing: '0.05em' }}>
              &copy; 2026 INPHORA SYSTEMS · VERSION 5.8.2
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
