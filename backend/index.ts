import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { Client } from 'ssh2';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '../.env' });

// ─── B2 S3 Client ──────────────────────────────────────────
const s3Client = new S3Client({
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  region: 'us-east-005', // B2 regions are usually specified in the endpoint, but SDK needs a value
  credentials: {
    accessKeyId: process.env.B2_APPLICATION_KEY_ID || '',
    secretAccessKey: process.env.B2_APPLICATION_KEY || '',
  },
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ─── Database ───────────────────────────────────────────────
const db = new Database('./data.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_percent REAL,
    mem_used INTEGER,
    mem_total INTEGER,
    rx_bps REAL,
    tx_bps REAL,
    disk_read REAL DEFAULT 0,
    disk_write REAL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ip TEXT NOT NULL UNIQUE,
    ssh_user TEXT DEFAULT 'root',
    ssh_password TEXT,
    ssh_port INTEGER DEFAULT 22,
    is_cloud INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_metrics_server_time ON metrics(server_id, timestamp);
`);

// Migrate: add missing columns to old DB schemas
try {
  const cols = db.pragma('table_info(servers)').map((c: any) => c.name);
  if (!cols.includes('ssh_password')) db.exec("ALTER TABLE servers ADD COLUMN ssh_password TEXT;");
  if (!cols.includes('ssh_port')) db.exec("ALTER TABLE servers ADD COLUMN ssh_port INTEGER DEFAULT 22;");
  if (!cols.includes('ssh_user')) db.exec("ALTER TABLE servers ADD COLUMN ssh_user TEXT DEFAULT 'root';");
  if (!cols.includes('is_cloud')) db.exec("ALTER TABLE servers ADD COLUMN is_cloud INTEGER DEFAULT 0;");
} catch (e) { console.log('Migration check:', e); }

// Seed default admin user
const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get(process.env.ADMIN_USERNAME || 'admin');
if (!adminUser) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin', 10);
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(process.env.ADMIN_USERNAME || 'admin', hash);
}

// Prune old metrics (keep 7 days)
setInterval(() => {
  db.prepare("DELETE FROM metrics WHERE timestamp < datetime('now', '-7 days')").run();
}, 3600_000);

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

// ─── Hetzner Cloud API ──────────────────────────────────────
const hetznerApi = axios.create({
  baseURL: 'https://api.hetzner.cloud/v1',
  headers: { Authorization: `Bearer ${process.env.HETZNER_API_TOKEN}` },
});

// ─── Auth Middleware ────────────────────────────────────────
function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── SSH Helper ─────────────────────────────────────────────
function sshExec(ip: string, user: string, password: string, command: string, port = 22): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timeout = setTimeout(() => { conn.end(); reject(new Error('SSH timeout')); }, 15000);
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { clearTimeout(timeout); conn.end(); return reject(err); }
        let output = '';
        stream.on('close', () => { clearTimeout(timeout); conn.end(); resolve(output); });
        stream.on('data', (data: any) => { output += data.toString(); });
        stream.stderr.on('data', (data: any) => { output += data.toString(); });
      });
    }).on('error', (err) => { clearTimeout(timeout); reject(err); });
    conn.connect({ host: ip, port, username: user, password, readyTimeout: 10000 });
  });
}

function getServerById(id: number): any {
  return db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
}

// ═══════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username: user.username });
});

app.get('/api/auth/me', authMiddleware, (req: any, res) => {
  res.json({ username: req.user.username });
});

// ═══════════════════════════════════════════════════════════
// MANAGED SERVERS (CRUD)
// ═══════════════════════════════════════════════════════════
app.get('/api/servers', authMiddleware, (req, res) => {
  try {
    const servers = db.prepare('SELECT * FROM servers').all();
    res.json({ servers: servers.map((s: any) => ({ id: s.id, name: s.name, ip: s.ip, ssh_user: s.ssh_user || 'root', ssh_port: s.ssh_port || 22, is_cloud: s.is_cloud || 0 })) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/servers', authMiddleware, (req, res) => {
  const { name, ip, ssh_user, ssh_password, ssh_port } = req.body;
  if (!name || !ip) return res.status(400).json({ error: 'name and ip are required' });
  try {
    const result = db.prepare('INSERT INTO servers (name, ip, ssh_user, ssh_password, ssh_port) VALUES (?, ?, ?, ?, ?)').run(
      name, ip, ssh_user || 'root', ssh_password || '', ssh_port || 22
    );
    res.json({ id: result.lastInsertRowid, name, ip });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/servers/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Test connection
app.post('/api/servers/:id/test', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'echo OK && uname -a', srv.ssh_port);
    res.json({ success: true, output });
  } catch (e: any) {
    res.json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// SERVER INSPECTION (via SSH)
// ═══════════════════════════════════════════════════════════

// System info
app.get('/api/servers/:id/info', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const [hostname, uname, uptime, memRaw, dfRaw, cpuInfo] = await Promise.all([
      sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'hostname', srv.ssh_port),
      sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'uname -a', srv.ssh_port),
      sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'uptime -p 2>/dev/null || uptime', srv.ssh_port),
      sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'free -b', srv.ssh_port),
      sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'df -B1 /', srv.ssh_port),
      sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'nproc', srv.ssh_port),
    ]);
    res.json({ hostname: hostname.trim(), uname: uname.trim(), uptime: uptime.trim(), memory: memRaw.trim(), disk: dfRaw.trim(), cores: cpuInfo.trim() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Live metrics snapshot
app.get('/api/servers/:id/metrics', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const script = `
      echo "CPU_START"; head -1 /proc/stat; sleep 1; echo "CPU_END"; head -1 /proc/stat;
      echo "MEM_START"; cat /proc/meminfo | head -5; echo "MEM_END";
      echo "NET_START"; cat /proc/net/dev | grep -v lo | tail -n +3; echo "NET_END";
      echo "LOAD_START"; cat /proc/loadavg; echo "LOAD_END";
    `;
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, script, srv.ssh_port);
    res.json({ raw: output });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Processes
app.get('/api/servers/:id/processes', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'ps aux --sort=-%cpu | head -50', srv.ssh_port);
    const lines = output.trim().split('\n');
    const header = lines[0];
    const processes = lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        user: parts[0], pid: parts[1], cpu: parts[2], mem: parts[3],
        vsz: parts[4], rss: parts[5], tty: parts[6], stat: parts[7],
        start: parts[8], time: parts[9], command: parts.slice(10).join(' ')
      };
    });
    res.json({ processes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Kill process
app.post('/api/servers/:id/kill', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { pid } = req.body;
  if (!pid) return res.status(400).json({ error: 'pid required' });
  try {
    await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, `kill -9 ${pid}`, srv.ssh_port);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Systemd services
app.get('/api/servers/:id/services', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password,
      'systemctl list-units --type=service --all --no-pager --plain | head -60', srv.ssh_port);
    const lines = output.trim().split('\n').filter(l => l.includes('.service'));
    const services = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return { unit: parts[0], load: parts[1], active: parts[2], sub: parts[3], description: parts.slice(4).join(' ') };
    });
    res.json({ services });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Service action (start/stop/restart)
app.post('/api/servers/:id/services/:name/:action', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { name, action } = req.params;
  if (!['start', 'stop', 'restart'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  try {
    await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, `systemctl ${action} ${name}`, srv.ssh_port);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Network connections
app.get('/api/servers/:id/connections', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password,
      'ss -tunap 2>/dev/null | head -50', srv.ssh_port);
    const lines = output.trim().split('\n');
    const connections = lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return { protocol: parts[0], state: parts[1], recv: parts[2], send: parts[3], local: parts[4], remote: parts[5], process: parts[6] || '' };
    });
    res.json({ connections });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Logs (journalctl)
app.get('/api/servers/:id/logs', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { service, severity, lines: numLines, search } = req.query;
  let cmd = 'journalctl --no-pager -n ' + (numLines || '100');
  if (service) cmd += ` -u ${service}`;
  if (severity) cmd += ` -p ${severity}`;
  if (search) cmd += ` --grep="${search}"`;
  cmd += ' 2>/dev/null || tail -n ' + (numLines || '100') + ' /var/log/syslog 2>/dev/null || echo "No logs available"';
  try {
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, cmd, srv.ssh_port);
    res.json({ logs: output });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Hardware info
app.get('/api/servers/:id/hardware', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const script = `
      echo "===TEMP==="; cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null || echo "N/A";
      echo "===UPTIME==="; cat /proc/uptime;
      echo "===SMART==="; smartctl -a /dev/sda 2>/dev/null || smartctl -a /dev/vda 2>/dev/null || smartctl -a /dev/nvme0n1 2>/dev/null || echo "smartctl not available";
      echo "===SENSORS==="; sensors 2>/dev/null || echo "sensors not available";
      echo "===DISKS==="; lsblk -o NAME,SIZE,TYPE,MOUNTPOINT,FSTYPE 2>/dev/null || echo "lsblk not available";
    `;
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, script, srv.ssh_port);
    res.json({ raw: output });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// FILE BROWSER & SITES DETECTION
// ═══════════════════════════════════════════════════════════

// List directory contents
app.get('/api/servers/:id/files', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const dirPath = (req.query.path as string) || '/';
  // Sanitize path to prevent command injection
  const safePath = dirPath.replace(/[;&|`$(){}]/g, '');
  try {
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password,
      `ls -la --time-style=long-iso "${safePath}" 2>&1`, srv.ssh_port);
    const lines = output.trim().split('\n');
    const entries = lines.slice(1).filter(l => l.trim()).map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 8) return null;
      const perms = parts[0];
      const isDir = perms.startsWith('d');
      const isLink = perms.startsWith('l');
      const size = parseInt(parts[4]) || 0;
      const date = parts[5] + ' ' + parts[6];
      const name = parts.slice(7).join(' ').split(' -> ')[0];
      const linkTarget = isLink ? parts.slice(7).join(' ').split(' -> ')[1] || '' : '';
      if (name === '.' || name === '..') return null;
      return { name, isDir, isLink, size, date, perms, owner: parts[2], group: parts[3], linkTarget };
    }).filter(Boolean);
    res.json({ path: safePath, entries });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Read file content (limited to 100KB for safety)
app.get('/api/servers/:id/file-content', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const filePath = (req.query.path as string) || '';
  const safePath = filePath.replace(/[;&|`$(){}]/g, '');
  try {
    // Check file size first
    const sizeOut = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password,
      `stat --printf="%s" "${safePath}" 2>/dev/null || echo "0"`, srv.ssh_port);
    const fileSize = parseInt(sizeOut) || 0;
    if (fileSize > 102400) {
      return res.json({ content: `[File too large: ${(fileSize / 1024).toFixed(1)} KB. Max 100KB for preview.]`, truncated: true, size: fileSize });
    }
    // Get mime type
    const mimeOut = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password,
      `file --mime-type -b "${safePath}" 2>/dev/null || echo "unknown"`, srv.ssh_port);
    const mime = mimeOut.trim();
    const isBinary = mime.startsWith('application/') && !mime.includes('json') && !mime.includes('xml') && !mime.includes('javascript') && !mime.includes('x-empty');
    if (isBinary) {
      return res.json({ content: `[Binary file: ${mime}, ${(fileSize / 1024).toFixed(1)} KB]`, binary: true, mime, size: fileSize });
    }
    const content = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password,
      `cat "${safePath}" 2>&1`, srv.ssh_port);
    res.json({ content, size: fileSize, mime });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Detect installed sites and systems
app.get('/api/servers/:id/sites', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const script = `
      echo "===NGINX_SITES===";
      ls /etc/nginx/sites-enabled/ 2>/dev/null && echo "---" && for f in /etc/nginx/sites-enabled/*; do echo "FILE:$f"; grep -E 'server_name|root|proxy_pass|listen' "$f" 2>/dev/null; echo "---"; done || echo "nginx not found";

      echo "===APACHE_SITES===";
      ls /etc/apache2/sites-enabled/ 2>/dev/null && echo "---" && for f in /etc/apache2/sites-enabled/*; do echo "FILE:$f"; grep -E 'ServerName|DocumentRoot|ProxyPass|Listen' "$f" 2>/dev/null; echo "---"; done || echo "apache not found";

      echo "===DOCKER_CONTAINERS===";
      docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || podman ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo "no containers";

      echo "===PM2_APPS===";
      pm2 jlist 2>/dev/null || echo "pm2 not found";

      echo "===SYSTEMD_WEB===";
      systemctl list-units --type=service --state=active --no-pager 2>/dev/null | grep -iE 'nginx|apache|httpd|caddy|node|pm2|gunicorn|uvicorn|docker|podman|mysql|mariadb|postgres|redis|mongo|certbot' || echo "none found";

      echo "===WWW_DIRS===";
      ls -d /var/www/*/ 2>/dev/null || echo "no /var/www";

      echo "===OPT_DIRS===";
      ls -d /opt/*/ 2>/dev/null || echo "no /opt apps";

      echo "===HOME_DIRS===";
      ls -d /home/*/ 2>/dev/null || echo "no home dirs";

      echo "===LISTENING_PORTS===";
      ss -tlnp 2>/dev/null | grep LISTEN;

      echo "===SSL_CERTS===";
      ls /etc/letsencrypt/live/ 2>/dev/null || echo "no certbot certs";

      echo "===DATABASES===";
      systemctl is-active mysql 2>/dev/null && echo "mysql: active" || echo "mysql: inactive";
      systemctl is-active mariadb 2>/dev/null && echo "mariadb: active" || echo "mariadb: inactive";
      systemctl is-active postgresql 2>/dev/null && echo "postgresql: active" || echo "postgresql: inactive";
      systemctl is-active redis-server 2>/dev/null && echo "redis: active" || echo "redis: inactive";
      systemctl is-active mongod 2>/dev/null && echo "mongod: active" || echo "mongod: inactive";

      echo "===CRON_JOBS===";
      crontab -l 2>/dev/null || echo "no crontab";

      echo "===INSTALLED_PACKAGES===";
      dpkg -l 2>/dev/null | grep -iE 'nginx|apache|node|python3|php|mysql|postgres|redis|docker|certbot|fail2ban|ufw' | awk '{print $2, $3}' || echo "none";
    `;
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, script, srv.ssh_port);
    
    // Parse the output into structured sections
    const sections: Record<string, string> = {};
    const parts = output.split(/===(\w+)===/);
    for (let i = 1; i < parts.length; i += 2) {
      sections[parts[i]] = parts[i + 1]?.trim() || '';
    }
    res.json({ sections });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// DATABASE ACCESS & BACKUPS
// ═══════════════════════════════════════════════════════════

// Detect databases
app.get('/api/servers/:id/databases', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const script = `
      echo "===MYSQL===";
      mysql -e "SHOW DATABASES;" 2>/dev/null || echo "not available";
      echo "===POSTGRES===";
      sudo -u postgres psql -l 2>/dev/null || echo "not available";
      echo "===SQLITE===";
      find /opt /var/www /home -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3" 2>/dev/null | head -20 || echo "none";
    `;
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, script, srv.ssh_port);
    const sections: Record<string, string> = {};
    const parts = output.split(/===(\w+)===/);
    for (let i = 1; i < parts.length; i += 2) {
      sections[parts[i]] = parts[i + 1]?.trim() || '';
    }
    res.json({ sections });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// List tables in a database
app.post('/api/servers/:id/db/tables', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { dbType, dbName } = req.body;
  try {
    let cmd = '';
    if (dbType === 'mysql') cmd = `mysql -e "USE ${dbName}; SHOW TABLES;" 2>&1`;
    else if (dbType === 'postgres') cmd = `sudo -u postgres psql -d ${dbName} -c "\\dt" 2>&1`;
    else if (dbType === 'sqlite') cmd = `sqlite3 "${dbName}" ".tables" 2>&1`;
    else return res.status(400).json({ error: 'Invalid dbType' });
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, cmd, srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Run read-only query
app.post('/api/servers/:id/db/query', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { dbType, dbName, query } = req.body;
  const safeQuery = query?.replace(/;.*$/g, '').trim();
  if (!safeQuery || /\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|CREATE)\b/i.test(safeQuery)) {
    return res.status(400).json({ error: 'Only SELECT/SHOW/DESCRIBE queries allowed' });
  }
  try {
    let cmd = '';
    if (dbType === 'mysql') cmd = `mysql -e "USE ${dbName}; ${safeQuery};" 2>&1`;
    else if (dbType === 'postgres') cmd = `sudo -u postgres psql -d ${dbName} -c "${safeQuery}" 2>&1`;
    else if (dbType === 'sqlite') cmd = `sqlite3 -header -column "${dbName}" "${safeQuery}" 2>&1`;
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, cmd, srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Create backup
app.post('/api/servers/:id/backup', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { type, dbName, path } = req.body;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    let cmd = '';
    if (type === 'mysql') {
      cmd = `mysqldump "${dbName}" 2>/dev/null | gzip > /tmp/backup-${dbName}-${ts}.sql.gz && echo "OK:/tmp/backup-${dbName}-${ts}.sql.gz"`;
    } else if (type === 'postgres') {
      cmd = `sudo -u postgres pg_dump "${dbName}" 2>/dev/null | gzip > /tmp/backup-${dbName}-${ts}.sql.gz && echo "OK:/tmp/backup-${dbName}-${ts}.sql.gz"`;
    } else if (type === 'sqlite') {
      cmd = `cp "${dbName}" "/tmp/backup-sqlite-${ts}.db" && echo "OK:/tmp/backup-sqlite-${ts}.db"`;
    } else if (type === 'directory') {
      const safePath = (path || '').replace(/[;&|`$(){}]/g, '');
      cmd = `tar czf /tmp/backup-dir-${ts}.tar.gz -C "${safePath}" . 2>&1 && echo "OK:/tmp/backup-dir-${ts}.tar.gz"`;
    } else if (type === 'full') {
      cmd = `tar czf /tmp/backup-full-${ts}.tar.gz /var/www /opt /etc/nginx /etc/letsencrypt 2>/dev/null; echo "OK:/tmp/backup-full-${ts}.tar.gz"`;
    }
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, cmd, srv.ssh_port);
    const okLine = output.split('\n').find(l => l.startsWith('OK:'));
    if (okLine) {
      res.json({ success: true, file: okLine.replace('OK:', ''), output });
    } else {
      res.json({ success: false, output });
    }
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// List existing backups
app.get('/api/servers/:id/backups', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  try {
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password,
      'ls -lh /tmp/backup-* 2>/dev/null || echo "No backups found"', srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Upload backup to Backblaze B2
app.post('/api/servers/:id/backups/upload', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  try {
    // 1. Download file from remote server to local buffer
    const conn = new Client();
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', resolve).on('error', reject).connect({
        host: srv.ip, port: srv.ssh_port || 22, username: srv.ssh_user, password: srv.ssh_password
      });
    });

    const sftp = await new Promise<any>((resolve, reject) => {
      conn.sftp((err, sftp) => err ? reject(err) : resolve(sftp));
    });

    const localTmpPath = path.join(__dirname, 'tmp_backup_' + Date.now());
    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(filename, localTmpPath, (err: any) => err ? reject(err) : resolve());
    });
    conn.end();

    // 2. Upload to B2
    const fileContent = fs.readFileSync(localTmpPath);
    const b2Name = `backups/${srv.name}/${path.basename(filename)}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: b2Name,
      Body: fileContent,
    }));

    // 3. Cleanup local temp file
    fs.unlinkSync(localTmpPath);

    res.json({ success: true, b2Path: b2Name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Backblaze B2 Storage Management ────────────────────────
app.get('/api/storage/files', authMiddleware, async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.B2_BUCKET_NAME,
      Prefix: req.query.prefix as string || '',
    });
    const data = await s3Client.send(command);
    res.json({
      files: data.Contents?.map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
      })) || []
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/storage/files', authMiddleware, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/storage/stats', authMiddleware, async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.B2_BUCKET_NAME,
    });
    const data = await s3Client.send(command);
    const totalSize = data.Contents?.reduce((acc, item) => acc + (item.Size || 0), 0) || 0;
    const count = data.Contents?.length || 0;
    res.json({ totalSize, count, bucket: process.env.B2_BUCKET_NAME });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
// FILE MANAGER EXTENDED (Phase 2)
// ═══════════════════════════════════════════════════════════
app.post('/api/servers/:id/files/save', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  const { path, content } = req.body;
  if (!path) return res.status(400).json({ error: 'path required' });
  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', resolve).on('error', reject).connect({
        host: srv.ip, port: srv.ssh_port || 22, username: srv.ssh_user, password: srv.ssh_password
      });
    });
    const sftp = await new Promise<any>((resolve, reject) => {
      conn.sftp((err, s) => err ? reject(err) : resolve(s));
    });
    await new Promise<void>((resolve, reject) => {
      const stream = sftp.createWriteStream(path);
      stream.on('error', reject).on('close', resolve);
      stream.end(content);
    });
    conn.end();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/servers/:id/files/delete', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  const { path } = req.body;
  try {
    await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, `rm -rf "${path}"`, srv.ssh_port);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/servers/:id/files/mkdir', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  const { path } = req.body;
  try {
    await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, `mkdir -p "${path}"`, srv.ssh_port);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// FIREWALL MANAGER (Phase 2)
// ═══════════════════════════════════════════════════════════
app.get('/api/servers/:id/firewall', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  try {
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, 'sudo ufw status numbered 2>&1', srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/servers/:id/firewall/rule', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  const { action, port, proto } = req.body; // action: allow/deny/delete
  try {
    let cmd = `sudo ufw ${action} ${port}`;
    if (proto) cmd += `/${proto}`;
    if (action === 'delete') cmd = `sudo ufw delete ${port}`; // port here is index if delete
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, `${cmd} 2>&1`, srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// SSL MANAGER (Phase 2)
// ═══════════════════════════════════════════════════════════
app.post('/api/servers/:id/ssl/issue', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  const { domain, email } = req.body;
  try {
    const cmd = `sudo certbot certonly --nginx -d ${domain} --non-interactive --agree-tos -m ${email} 2>&1`;
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, cmd, srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// WEBSITE MANAGER (Phase 3)
// ═══════════════════════════════════════════════════════════
app.post('/api/servers/:id/sites/add', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  const { domain, root, type } = req.body; // type: php, static, proxy
  try {
    const vhost = `
server {
    listen 80;
    server_name ${domain};
    root ${root};
    index index.html index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    ${type === 'php' ? `
    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php-fpm.sock;
    }` : ''}
}`;
    const escapedVhost = vhost.replace(/'/g, "'\\''");
    const cmd = `
      echo '${escapedVhost}' | sudo tee /etc/nginx/sites-available/${domain} > /dev/null && 
      sudo ln -sf /etc/nginx/sites-available/${domain} /etc/nginx/sites-enabled/ &&
      sudo mkdir -p ${root} && 
      sudo chown -R www-data:www-data ${root} &&
      sudo nginx -t && sudo systemctl reload nginx
    `;
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, cmd, srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// DATABASE CRUD (Phase 3)
// ═══════════════════════════════════════════════════════════
app.post('/api/servers/:id/db/create', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  const { dbType, dbName } = req.body;
  try {
    let cmd = '';
    if (dbType === 'mysql') cmd = `mysql -e "CREATE DATABASE IF NOT EXISTS ${dbName};"`;
    else if (dbType === 'postgres') cmd = `sudo -u postgres psql -c "CREATE DATABASE ${dbName};"`;
    else return res.status(400).json({ error: 'Unsupported DB type' });
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, cmd, srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/servers/:id/db/user/create', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  const { dbType, dbName, username, password } = req.body;
  try {
    let cmd = '';
    if (dbType === 'mysql') {
      cmd = `mysql -e "CREATE USER IF NOT EXISTS '${username}'@'localhost' IDENTIFIED BY '${password}'; GRANT ALL PRIVILEGES ON ${dbName}.* TO '${username}'@'localhost'; FLUSH PRIVILEGES;"`;
    } else if (dbType === 'postgres') {
      cmd = `sudo -u postgres psql -c "CREATE USER ${username} WITH PASSWORD '${password}'; GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${username};"`;
    }
    const output = await sshExec(srv.ip, srv.ssh_user, srv.ssh_password, cmd, srv.ssh_port);
    res.json({ output });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// HETZNER CLOUD API PROXY
// ═══════════════════════════════════════════════════════════

// Servers
app.get('/api/cloud/servers', authMiddleware, async (req, res) => {
  try {
    const r = await hetznerApi.get('/servers');
    res.json(r.data);
  } catch (e: any) {
    res.json({ servers: [], error: e.message });
  }
});

// Server actions
app.post('/api/cloud/servers/:id/actions/:action', authMiddleware, async (req, res) => {
  const { id, action } = req.params;
  const validActions: any = { poweron: 'poweron', poweroff: 'poweroff', reboot: 'reboot', shutdown: 'shutdown' };
  if (!validActions[action]) return res.status(400).json({ error: 'Invalid action' });
  try {
    const r = await hetznerApi.post(`/servers/${id}/actions/${action}`);
    res.json(r.data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Rebuild from snapshot
app.post('/api/cloud/servers/:id/actions/rebuild', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { image } = req.body;
  try {
    const r = await hetznerApi.post(`/servers/${id}/actions/rebuild`, { image });
    res.json(r.data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Volumes
app.get('/api/cloud/volumes', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.get('/volumes'); res.json(r.data); }
  catch (e: any) { res.json({ volumes: [], error: e.message }); }
});

app.post('/api/cloud/volumes', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.post('/volumes', req.body); res.json(r.data); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cloud/volumes/:id', authMiddleware, async (req, res) => {
  try { await hetznerApi.delete(`/volumes/${req.params.id}`); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cloud/volumes/:id/actions/attach', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.post(`/volumes/${req.params.id}/actions/attach`, req.body); res.json(r.data); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cloud/volumes/:id/actions/detach', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.post(`/volumes/${req.params.id}/actions/detach`); res.json(r.data); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Snapshots
app.get('/api/cloud/snapshots', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.get('/images?type=snapshot'); res.json(r.data); }
  catch (e: any) { res.json({ images: [], error: e.message }); }
});

app.post('/api/cloud/servers/:id/snapshots', authMiddleware, async (req, res) => {
  try {
    const r = await hetznerApi.post(`/servers/${req.params.id}/actions/create_image`, { description: req.body.description || 'Snapshot', type: 'snapshot' });
    res.json(r.data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/cloud/snapshots/:id', authMiddleware, async (req, res) => {
  try { await hetznerApi.delete(`/images/${req.params.id}`); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Floating IPs
app.get('/api/cloud/floating-ips', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.get('/floating_ips'); res.json(r.data); }
  catch (e: any) { res.json({ floating_ips: [], error: e.message }); }
});

// Networks
app.get('/api/cloud/networks', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.get('/networks'); res.json(r.data); }
  catch (e: any) { res.json({ networks: [], error: e.message }); }
});

// Load Balancers
app.get('/api/cloud/load-balancers', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.get('/load_balancers'); res.json(r.data); }
  catch (e: any) { res.json({ load_balancers: [], error: e.message }); }
});

// Pricing
app.get('/api/cloud/pricing', authMiddleware, async (req, res) => {
  try { const r = await hetznerApi.get('/pricing'); res.json(r.data); }
  catch (e: any) { res.json({ pricing: null, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// CRON MANAGEMENT
// ═══════════════════════════════════════════════════════════
app.get('/api/servers/:id/crons', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', resolve).on('error', reject).connect({
        host: srv.ip, port: srv.ssh_port || 22,
        username: srv.ssh_user || 'root', password: srv.ssh_password,
      });
    });
    const output = await new Promise<string>((resolve, reject) => {
      conn.exec('crontab -l 2>/dev/null || echo ""', (err, stream) => {
        if (err) return reject(err);
        let out = '';
        stream.on('data', (d: Buffer) => out += d.toString());
        stream.stderr.on('data', () => {});
        stream.on('close', () => resolve(out));
      });
    });
    conn.end();
    const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const crons = lines.map((line, i) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) return null;
      const [minute, hour, day, month, weekday, ...cmdParts] = parts;
      return { id: i, minute, hour, day, month, weekday, command: cmdParts.join(' '), raw: line };
    }).filter(Boolean);
    res.json({ crons });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/api/servers/:id/crons', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { minute, hour, day, month, weekday, command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  const cronLine = `${minute || '*'} ${hour || '*'} ${day || '*'} ${month || '*'} ${weekday || '*'} ${command}`;
  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', resolve).on('error', reject).connect({
        host: srv.ip, port: srv.ssh_port || 22,
        username: srv.ssh_user || 'root', password: srv.ssh_password,
      });
    });
    const script = `(crontab -l 2>/dev/null; echo '${cronLine.replace(/'/g, `'\''`)}') | crontab -`;
    await new Promise<void>((resolve, reject) => {
      conn.exec(script, (err, stream) => {
        if (err) return reject(err);
        stream.on('close', resolve);
        stream.stderr.on('data', () => {});
      });
    });
    conn.end();
    res.json({ success: true, cronLine });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/servers/:id/crons', authMiddleware, async (req, res) => {
  const srv: any = getServerById(Number(req.params.id));
  if (!srv) return res.status(404).json({ error: 'Server not found' });
  const { raw } = req.body;
  if (!raw) return res.status(400).json({ error: 'raw cron line required' });
  const conn = new Client();
  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', resolve).on('error', reject).connect({
        host: srv.ip, port: srv.ssh_port || 22,
        username: srv.ssh_user || 'root', password: srv.ssh_password,
      });
    });
    const escaped = raw.replace(/["\\]/g, '\\$&');
    await new Promise<void>((resolve, reject) => {
      conn.exec(`crontab -l 2>/dev/null | grep -v "^${escaped}$" | crontab -`, (err, stream) => {
        if (err) return reject(err);
        stream.on('close', resolve);
        stream.stderr.on('data', () => {});
      });
    });
    conn.end();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════
// SSH TERMINAL via Socket.IO
// ═══════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  let sshClient: any = null;
  let sshStream: any = null;

  socket.on('terminal:start', async (data: { serverId: number; token: string; cols?: number; rows?: number }) => {
    try { jwt.verify(data.token, JWT_SECRET); } catch { socket.emit('terminal:error', 'Unauthorized'); return; }
    const srv: any = getServerById(Number(data.serverId));
    if (!srv) { socket.emit('terminal:error', 'Server not found'); return; }
    sshClient = new Client();
    sshClient.on('ready', () => {
      sshClient.shell({ term: 'xterm-256color', cols: data.cols || 80, rows: data.rows || 24 }, (err: any, stream: any) => {
        if (err) { socket.emit('terminal:error', err.message); return; }
        sshStream = stream;
        socket.emit('terminal:ready', {});
        stream.on('data', (chunk: Buffer) => socket.emit('terminal:output', chunk.toString('utf8')));
        stream.stderr.on('data', (chunk: Buffer) => socket.emit('terminal:output', chunk.toString('utf8')));
        stream.on('close', () => { socket.emit('terminal:closed', {}); sshClient?.end(); });
      });
    });
    sshClient.on('error', (err: any) => socket.emit('terminal:error', err.message));
    sshClient.connect({ host: srv.ip, port: srv.ssh_port || 22, username: srv.ssh_user || 'root', password: srv.ssh_password });
  });

  socket.on('terminal:input', (data: string) => { sshStream?.write(data); });
  socket.on('terminal:resize', (data: { cols: number; rows: number }) => { sshStream?.setWindow(data.rows, data.cols, 0, 0); });
  socket.on('disconnect', () => { sshStream?.close(); sshClient?.end(); });
});

// ═══════════════════════════════════════════════════════════
// METRICS HISTORY
// ═══════════════════════════════════════════════════════════
app.get('/api/metrics/:serverId/history', authMiddleware, (req, res) => {
  const { serverId } = req.params;
  const range = (req.query.range as string) || '1h';
  const rangeMap: any = { '1h': '-1 hour', '6h': '-6 hours', '24h': '-24 hours', '7d': '-7 days' };
  const sqlRange = rangeMap[range] || '-1 hour';
  const rows = db.prepare(`SELECT * FROM metrics WHERE server_id = ? AND timestamp >= datetime('now', ?) ORDER BY timestamp ASC`).all(serverId, sqlRange);
  res.json({ metrics: rows });
});

// Agent Metrics Ingestion (no auth for agents – they use their own key)
app.post('/api/metrics/ingest', (req, res) => {
  const data = req.body;
  if (!data || !data.server_id) return res.status(400).send('Invalid data');
  const { server_id, cpu, memory, network } = data;
  db.prepare('INSERT INTO metrics (server_id, cpu_percent, mem_used, mem_total, rx_bps, tx_bps) VALUES (?, ?, ?, ?, ?, ?)').run(
    server_id, cpu.usage_percent, memory.used, memory.total, network.rx_bps, network.tx_bps
  );
  io.emit('metrics_update', data);
  res.status(200).send('OK');
});

// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Hetzner Dashboard backend running on port ${PORT}`);
});
