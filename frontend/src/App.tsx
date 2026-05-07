import { useEffect } from 'react';
import { useStore } from './store';
import { io } from 'socket.io-client';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Overview from './components/Overview';
import CloudResources from './components/CloudResources';
import ServerDetail from './components/ServerDetail';
import SettingsPage from './components/Settings';
import Storage from './components/Storage';

const socket = io(window.location.origin);

function App() {
  const { token, currentPage, updateMetrics, toast } = useStore();

  useEffect(() => {
    socket.on('metrics_update', (data) => {
      updateMetrics(data.server_id, data);
    });
    return () => { socket.off('metrics_update'); };
  }, [updateMetrics]);

  // Not authenticated → show login
  if (!token) return <Login />;

  const pages: Record<string, React.ReactNode> = {
    'overview': <Overview />,
    'cloud': <CloudResources />,
    'server-detail': <ServerDetail />,
    'settings': <SettingsPage />,
    'storage': <Storage />,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 32, overflowY: 'auto', maxHeight: '100vh' }}>
        {pages[currentPage] || <Overview />}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
