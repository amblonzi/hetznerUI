import { useEffect, useState } from 'react';
import { useStore, api } from '../store';
import { Search, Trash2, RefreshCw, File, Database, Cloud } from 'lucide-react';

export default function Storage() {
  const { showToast } = useStore();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [stats, setStats] = useState<{ totalSize: number; count: number; bucket: string } | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [filesData, statsData] = await Promise.all([
        api('/api/storage/files'),
        api('/api/storage/stats'),
      ]);
      setFiles(filesData.files || []);
      setStats(statsData);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
    setLoading(false);
  }

  async function deleteFile(key: string) {
    if (!confirm(`Are you sure you want to delete ${key}?`)) return;
    try {
      await api('/api/storage/files', {
        method: 'DELETE',
        body: JSON.stringify({ key }),
      });
      showToast('File deleted successfully', 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  const filteredFiles = files.filter(f => f.key.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>Backblaze B2 Storage</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>Manage your remote backups and cloud files</p>
        </div>
        <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
              <Database size={18} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Total Storage</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{stats ? formatSize(stats.totalSize) : '--'}</div>
        </div>
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80' }}>
              <File size={18} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>File Count</div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{stats ? stats.count : '--'}</div>
        </div>
        <div className="glass" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ padding: 8, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
              <Cloud size={18} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Cloud Bucket</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats?.bucket || '...'}
          </div>
        </div>
      </div>

      {/* File Explorer */}
      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              className="input"
              placeholder="Search files..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>
        </div>

        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Size</th>
                <th>Last Modified</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <File size={16} color="#818cf8" />
                      <span style={{ fontWeight: 500, color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12 }}>{file.key}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{formatSize(file.size)}</td>
                  <td style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(file.lastModified).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => deleteFile(file.key)}>
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredFiles.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                    No files found in the bucket.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
