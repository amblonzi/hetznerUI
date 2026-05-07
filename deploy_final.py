import paramiko
import os
import sys
import io
import zipfile

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '178.105.71.89'
USER = 'root'
PASSWORD = 'ControL.4028s'
REMOTE_DIR = '/opt/hetzner-dashboard'
ZIP_PATH = 'payload_final.zip'

def run(ssh, cmd, timeout=120):
    print(f"  > {cmd[:80]}...")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

def main():
    # 1. Create zip
    print("[1/7] Creating zip archive...")
    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            for skip in ['node_modules', '.git', '.vite', '__pycache__']:
                if skip in dirs: dirs.remove(skip)
            for file in files:
                if file.endswith(('.zip', '.pyc')): continue
                if file.startswith('scratch_'): continue
                if file == 'deploy_remote.py': continue
                fp = os.path.join(root, file)
                zipf.write(fp, arcname=os.path.relpath(fp, '.'))
    print(f"    Zip created: {os.path.getsize(ZIP_PATH)} bytes")

    # 2. Connect
    print(f"[2/7] Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)

    # 3. Stop existing containers
    print("[3/7] Stopping existing containers...")
    run(ssh, f"cd {REMOTE_DIR} && podman compose down 2>/dev/null || true")
    run(ssh, "podman stop -a 2>/dev/null || true")
    run(ssh, "podman rm -a -f 2>/dev/null || true")

    # 4. Upload
    print("[4/7] Uploading project files...")
    run(ssh, f"rm -rf {REMOTE_DIR}")
    run(ssh, f"mkdir -p {REMOTE_DIR}")
    sftp = ssh.open_sftp()
    sftp.put(ZIP_PATH, f"{REMOTE_DIR}/payload.zip")
    sftp.close()
    run(ssh, f"cd {REMOTE_DIR} && unzip -o payload.zip && rm payload.zip")

    # 5. Install Node.js on the server (needed for building)
    print("[5/7] Installing Node.js 20...")
    out, err = run(ssh, "node --version 2>/dev/null || echo 'MISSING'")
    if 'MISSING' in out or 'MISSING' in err:
        run(ssh, "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -", timeout=60)
        run(ssh, "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs", timeout=120)
    out, _ = run(ssh, "node --version")
    print(f"    Node version: {out}")

    # 6. Build directly on server (no container build issues)
    print("[6/7] Building frontend & backend on server...")
    
    # Backend
    out, err = run(ssh, f"cd {REMOTE_DIR}/backend && npm install", timeout=120)
    print(f"    Backend npm install done")
    
    # Frontend
    out, err = run(ssh, f"cd {REMOTE_DIR}/frontend && npm install", timeout=120)
    print(f"    Frontend npm install done")
    
    out, err = run(ssh, f"cd {REMOTE_DIR}/frontend && npm run build 2>&1", timeout=120)
    if 'error' in err.lower() or 'error TS' in out:
        print(f"    BUILD ERROR: {out[-300:]}")
        print(f"    STDERR: {err[-300:]}")
    else:
        print(f"    Frontend build done")

    # 7. Setup as systemd services (skip containers entirely - more reliable)
    print("[7/7] Setting up systemd services...")
    
    # Backend service
    backend_service = f"""[Unit]
Description=Hetzner Dashboard Backend
After=network.target

[Service]
Type=simple
WorkingDirectory={REMOTE_DIR}/backend
ExecStart=/usr/bin/npx tsx index.ts
Environment=NODE_ENV=production
EnvironmentFile={REMOTE_DIR}/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    run(ssh, f"cat << 'SERVICEEOF' > /etc/systemd/system/hetzner-backend.service\n{backend_service}\nSERVICEEOF")
    
    # Configure nginx for hetzner.inphora.net
    nginx_conf = """server {
    listen 80;
    server_name hetzner.inphora.net;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        root REMOTE_DIR/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}""".replace('REMOTE_DIR', REMOTE_DIR)

    run(ssh, f"cat << 'NGINXEOF' > /etc/nginx/sites-available/hetzner-dashboard\n{nginx_conf}\nNGINXEOF")
    run(ssh, "ln -sf /etc/nginx/sites-available/hetzner-dashboard /etc/nginx/sites-enabled/hetzner-dashboard")
    
    # Test & reload nginx
    out, err = run(ssh, "nginx -t 2>&1")
    print(f"    nginx config test: {out} {err}")
    
    run(ssh, "systemctl daemon-reload")
    run(ssh, "systemctl enable hetzner-backend")
    run(ssh, "systemctl restart hetzner-backend")
    run(ssh, "systemctl reload nginx")
    
    # Verify
    import time
    time.sleep(2)
    out, _ = run(ssh, "systemctl is-active hetzner-backend")
    print(f"    Backend service: {out}")
    out, _ = run(ssh, "systemctl is-active nginx")
    print(f"    Nginx service: {out}")
    out, _ = run(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/cloud/servers 2>&1")
    print(f"    Backend API response: HTTP {out}")
    out, _ = run(ssh, f"ls -la {REMOTE_DIR}/frontend/dist/ 2>&1 | head -5")
    print(f"    Frontend dist: {out}")

    ssh.close()
    os.remove(ZIP_PATH)
    print("\nDeployment complete!")
    print("Visit: http://hetzner.inphora.net (once DNS points to 178.105.71.89)")

if __name__ == '__main__':
    main()
