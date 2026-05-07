import { useStore } from '../store';
// Recharts removed temporarily to bypass Vite 8 bundler issue with es-toolkit

export default function Dashboard() {
  const { metrics, cloudServers } = useStore();

  return (
    <div className="space-y-8">
      {/* Module 1: Server Health & Performance */}
      <section id="overview">
        <h2 className="text-2xl font-bold mb-4">Real-time Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(metrics).map(([serverId, data]: any) => (
            <div key={serverId} className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold mb-4">{serverId}</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>CPU Usage</span>
                    <span className="text-blue-400">{data.cpu.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${data.cpu}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Memory</span>
                    <span className="text-green-400">{Math.round(data.memUsed / 1024 / 1024)}MB / {Math.round(data.memTotal / 1024 / 1024)}MB</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(data.memUsed / data.memTotal) * 100}%` }}></div>
                  </div>
                </div>
                
                {/* Mini Graph temporarily disabled */}
                <div className="h-32 mt-4 flex items-center justify-center bg-slate-900 rounded border border-slate-700">
                  <span className="text-slate-500 text-sm">Real-time graph disabled during dev mode</span>
                </div>
              </div>
            </div>
          ))}
          {Object.keys(metrics).length === 0 && (
            <div className="col-span-3 text-center text-slate-400 py-12 bg-slate-800 rounded-xl border border-slate-700 border-dashed">
              No servers reporting. Deploy the agent to see real-time metrics.
            </div>
          )}
        </div>
      </section>

      {/* Module 3: Cloud Resources */}
      <section id="cloud" className="pt-8">
        <h2 className="text-2xl font-bold mb-4">Hetzner Cloud Resources</h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Status</th>
                <th className="p-4">Type</th>
                <th className="p-4">Location</th>
                <th className="p-4">IP</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cloudServers.map((server: any) => (
                <tr key={server.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="p-4 font-medium">{server.name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${server.status === 'running' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {server.status}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300">{server.server_type.name}</td>
                  <td className="p-4 text-slate-300">{server.datacenter.location.name}</td>
                  <td className="p-4 text-slate-300">{server.public_net.ipv4.ip}</td>
                  <td className="p-4">
                    <button className="text-blue-400 hover:text-blue-300">Manage</button>
                  </td>
                </tr>
              ))}
              {cloudServers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No cloud servers found or API token not configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
