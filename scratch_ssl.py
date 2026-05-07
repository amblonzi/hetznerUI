import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('178.105.71.89', username='root', password='ControL.4028s')

def run(cmd):
    print(f"> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out: print(out)
    if err: print(err)
    return out, err

# Run certbot to get SSL for hetzner.inphora.net
print("Getting SSL certificate for hetzner.inphora.net...")
run("certbot --nginx -d hetzner.inphora.net --non-interactive --agree-tos --email admin@inphora.net")

print("\nReloading nginx...")
run("systemctl reload nginx")

print("\nVerifying...")
run("curl -s -o /dev/null -w 'HTTP %{http_code}' https://hetzner.inphora.net/ 2>&1")

ssh.close()
print("\nDone!")
