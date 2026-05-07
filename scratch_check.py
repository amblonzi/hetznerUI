import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

HOST = '178.105.71.89'
USER = 'root'
PASSWORD = 'ControL.4028s'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

commands = [
    "echo '=== PODMAN CONTAINERS ==='",
    "podman ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'",
    "echo ''",
    "echo '=== PODMAN IMAGES ==='",
    "podman images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}'",
    "echo ''",
    "echo '=== LISTENING PORTS ==='",
    "ss -tlnp | head -20",
    "echo ''",
    "echo '=== CADDY STATUS ==='",
    "systemctl is-active caddy",
    "echo ''",
    "echo '=== CADDY CONFIG ==='",
    "cat /etc/caddy/Caddyfile",
    "echo ''",
    "echo '=== PROJECT FILES ==='",
    "ls -la /opt/hetzner-dashboard/",
    "echo ''",
    "echo '=== DOCKER-COMPOSE FILE ==='",
    "cat /opt/hetzner-dashboard/docker-compose.yml",
    "echo ''",
    "echo '=== PODMAN COMPOSE LOGS (last 30 lines) ==='",
    "cd /opt/hetzner-dashboard && podman compose logs --tail 30 2>&1 || echo 'No compose logs'",
    "echo ''",
    "echo '=== NODE.JS INSTALLED? ==='",
    "node --version 2>&1 || echo 'Node not installed'",
    "npm --version 2>&1 || echo 'npm not installed'",
    "echo ''",
    "echo '=== CURL LOCALHOST:3000 ==='",
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/cloud/servers 2>&1 || echo 'Backend not reachable'",
    "echo ''",
    "echo '=== CURL LOCALHOST:80 ==='",
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:80 2>&1 || echo 'Frontend not reachable'",
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out:
        print(out)
    if err and 'WARNING' not in err.upper():
        print(f"[ERR] {err}")

ssh.close()
