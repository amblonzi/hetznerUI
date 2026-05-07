import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('178.105.71.89', username='root', password='ControL.4028s')

def run(cmd):
    print(f"> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    if out: print(out)
    if err: print(f"ERROR: {err}")
    return out

print("=== Nginx Error Logs (last 20 lines) ===")
run("tail -n 20 /var/log/nginx/error.log")

print("\n=== Nginx Access Logs (last 20 lines) ===")
run("tail -n 20 /var/log/nginx/access.log")

ssh.close()
