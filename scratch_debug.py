import paramiko, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('178.105.71.89', username='root', password='ControL.4028s')
cmd = """
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"change_me_immediately"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "=== Server list ==="
curl -s http://localhost:3000/api/servers -H "Authorization: Bearer $TOKEN"
echo ""
echo "=== Sites scan ==="
curl -s http://localhost:3000/api/servers/1/sites -H "Authorization: Bearer $TOKEN" 2>&1 | head -c 500
"""
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print(stdout.read().decode('utf-8', errors='replace').strip())
ssh.close()
