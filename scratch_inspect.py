import paramiko

HOST = '178.105.71.89'
USER = 'root'
PASSWORD = 'ControL.4028s'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

for cmd in ["uname -a", "free -h", "df -h /", "uptime"]:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore').strip()
    print(f"[{cmd}]\n{out}\n")

ssh.close()
