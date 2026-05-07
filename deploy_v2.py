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
ZIP_PATH = 'payload_v2.zip'

def run(ssh, cmd, timeout=180):
    print(f"  > {cmd[:90]}...")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

def main():
    print("[1/6] Creating zip...")
    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            for skip in ['node_modules', '.git', '.vite', '__pycache__']:
                if skip in dirs: dirs.remove(skip)
            for file in files:
                if file.endswith(('.zip', '.pyc')): continue
                if file.startswith('scratch_') or file.startswith('deploy_') or file.startswith('payload'): continue
                fp = os.path.join(root, file)
                zipf.write(fp, arcname=os.path.relpath(fp, '.'))
    print(f"    Size: {os.path.getsize(ZIP_PATH)} bytes")

    print(f"[2/6] Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)

    print("[3/6] Uploading...")
    # Preserve the existing data.db
    run(ssh, f"cp {REMOTE_DIR}/backend/data.db /tmp/hetzner-data.db 2>/dev/null || true")
    run(ssh, f"rm -rf {REMOTE_DIR}")
    run(ssh, f"mkdir -p {REMOTE_DIR}")
    sftp = ssh.open_sftp()
    sftp.put(ZIP_PATH, f"{REMOTE_DIR}/payload.zip")
    sftp.close()
    run(ssh, f"cd {REMOTE_DIR} && unzip -o payload.zip && rm payload.zip")
    run(ssh, f"cp /tmp/hetzner-data.db {REMOTE_DIR}/backend/data.db 2>/dev/null || true")

    print("[4/6] Installing dependencies...")
    out, err = run(ssh, f"cd {REMOTE_DIR}/backend && npm install 2>&1", timeout=120)
    print(f"    Backend deps: done")

    out, err = run(ssh, f"cd {REMOTE_DIR}/frontend && npm install 2>&1", timeout=120)
    print(f"    Frontend deps: done")

    print("[5/6] Building frontend...")
    out, err = run(ssh, f"cd {REMOTE_DIR}/frontend && npm run build 2>&1", timeout=120)
    if 'error TS' in out.lower() or 'error TS' in err.lower():
        print(f"    BUILD ERROR:\n{out[-500:]}\n{err[-500:]}")
        ssh.close()
        return
    else:
        print(f"    Frontend build: success")

    print("[6/6] Restarting services...")
    run(ssh, "systemctl restart hetzner-backend")

    import time; time.sleep(2)
    out, _ = run(ssh, "systemctl is-active hetzner-backend")
    print(f"    Backend service: {out}")
    out, _ = run(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/auth/login 2>&1")
    print(f"    Backend API: HTTP {out}")
    out, _ = run(ssh, f"ls {REMOTE_DIR}/frontend/dist/index.html 2>&1")
    print(f"    Frontend: {out}")

    ssh.close()
    os.remove(ZIP_PATH)
    print("\n✓ Deployment complete! Visit https://hetzner.inphora.net")

if __name__ == '__main__':
    main()
