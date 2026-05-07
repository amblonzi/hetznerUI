import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('178.105.71.89', username='root', password='ControL.4028s')

cmd = "cd /opt/hetzner-dashboard && podman compose up -d"
stdin, stdout, stderr = ssh.exec_command(cmd)

# We just read to wait for it to finish, not printing to avoid unicode errors
stdout.read()
stderr.read()

ssh.close()
