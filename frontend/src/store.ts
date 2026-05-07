import { create } from 'zustand';

export type Page = 'overview' | 'cloud' | 'server-detail' | 'settings' | 'storage';

export interface ManagedServer {
  id: number;
  name: string;
  ip: string;
  ssh_user: string;
  ssh_port: number;
  is_cloud: number;
}

interface MetricPoint {
  cpu: number;
  memUsed: number;
  memTotal: number;
  netRx: number;
  netTx: number;
}

interface AppState {
  // Auth
  token: string | null;
  username: string | null;
  setAuth: (token: string, username: string) => void;
  logout: () => void;

  // Navigation
  currentPage: Page;
  selectedServerId: number | null;
  setPage: (page: Page) => void;
  selectServer: (id: number) => void;

  // Managed Servers
  servers: ManagedServer[];
  setServers: (servers: ManagedServer[]) => void;

  // Cloud
  cloudServers: any[];
  setCloudServers: (servers: any[]) => void;

  // Real-time metrics
  metrics: Record<string, MetricPoint & { history: any[] }>;
  updateMetrics: (serverId: string, data: any) => void;

  // UI
  loading: boolean;
  setLoading: (v: boolean) => void;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const useStore = create<AppState>((set) => ({
  token: localStorage.getItem('hetzner_token'),
  username: localStorage.getItem('hetzner_user'),
  setAuth: (token, username) => {
    localStorage.setItem('hetzner_token', token);
    localStorage.setItem('hetzner_user', username);
    set({ token, username });
  },
  logout: () => {
    localStorage.removeItem('hetzner_token');
    localStorage.removeItem('hetzner_user');
    set({ token: null, username: null });
  },

  currentPage: 'overview',
  selectedServerId: null,
  setPage: (page) => set({ currentPage: page }),
  selectServer: (id) => set({ selectedServerId: id, currentPage: 'server-detail' }),

  servers: [],
  setServers: (servers) => set({ servers }),
  cloudServers: [],
  setCloudServers: (cloudServers) => set({ cloudServers }),

  metrics: {},
  updateMetrics: (serverId, data) => set((state) => {
    const current = state.metrics[serverId] || { history: [] };
    const newHistory = [...current.history, { ...data, ts: Date.now() }].slice(-120);
    return {
      metrics: {
        ...state.metrics,
        [serverId]: {
          cpu: data.cpu?.usage_percent ?? 0,
          memUsed: data.memory?.used ?? 0,
          memTotal: data.memory?.total ?? 1,
          netRx: data.network?.rx_bps ?? 0,
          netTx: data.network?.tx_bps ?? 0,
          history: newHistory,
        },
      },
    };
  }),

  loading: false,
  setLoading: (v) => set({ loading: v }),
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 4000);
  },
}));

// API helper
const BASE = '';

export async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('hetzner_token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('hetzner_token');
    window.location.reload();
    throw new Error('Unauthorized');
  }
  return res.json();
}
