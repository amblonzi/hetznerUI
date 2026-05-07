import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('178.105.71.89', username='root', password='ControL.4028s')

commands = [
    "echo '=== NGINX SITES-ENABLED ==='",
    "ls -la /etc/nginx/sites-enabled/",
    "echo ''",
    "echo '=== HETZNER DASHBOARD VHOST ==='",
    "cat /etc/nginx/sites-available/hetzner-dashboard",
    "echo ''",
    "echo '=== ALL VHOSTS server_name lines ==='",
    "grep -r 'server_name' /etc/nginx/sites-enabled/ 2>/dev/null",
    "echo ''",
    "echo '=== DEFAULT SITE ==='",
    "cat /etc/nginx/sites-enabled/default 2>/dev/null || echo 'No default'",
    "echo ''",
    "echo '=== BOS CONFIG ==='",
    "cat /etc/nginx/sites-enabled/bos* 2>/dev/null || echo 'No bos config found in sites-enabled'",
    "grep -rl 'bos.inphora' /etc/nginx/ 2>/dev/null",
    "echo ''",
    "echo '=== NGINX MAIN CONF includes ==='",
    "grep -n 'include' /etc/nginx/nginx.conf",
    "echo ''",
    "echo '=== CURL with Host header ==='",
    "curl -s -o /dev/null -w '%{http_code}' -H 'Host: hetzner.inphora.net' http://localhost/ 2>&1",
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out: print(out)
    if err: print(f"  [err] {err}")

ssh.close()
