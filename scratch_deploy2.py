import paramiko
import os
import zipfile

HOST = '178.105.71.89'
USER = 'root'
PASSWORD = 'ControL.4028s'
REMOTE_DIR = '/opt/hetzner-dashboard'
ZIP_PATH = 'payload2.zip'

print("Creating zip archive...")
with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        if 'node_modules' in dirs: dirs.remove('node_modules')
        if '.git' in dirs: dirs.remove('.git')
        if '.vite' in dirs: dirs.remove('.vite')
            
        for file in files:
            if file.endswith('.zip') or file.endswith('.pyc'): continue
            file_path = os.path.join(root, file)
            zipf.write(file_path, arcname=os.path.relpath(file_path, '.'))

print(f"Connecting to {HOST}...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)

print("Uploading...")
sftp = ssh.open_sftp()
sftp.put(ZIP_PATH, f"{REMOTE_DIR}/payload2.zip")
sftp.close()

def run(cmd):
    print(f"> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    if out: print(out)
    if err: print(err)

run(f"cd {REMOTE_DIR} && unzip -o payload2.zip && rm payload2.zip")
run(f"cd {REMOTE_DIR} && podman compose build frontend")
run(f"cd {REMOTE_DIR} && podman compose up -d")

ssh.close()
if os.path.exists(ZIP_PATH):
    os.remove(ZIP_PATH)
print("Done!")
