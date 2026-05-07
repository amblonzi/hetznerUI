import paramiko
import os
import zipfile
import stat

HOST = '178.105.71.89'
USER = 'root'
PASSWORD = 'ControL.4028s'
REMOTE_DIR = '/opt/hetzner-dashboard'
ZIP_PATH = 'payload.zip'

def create_zip():
    print("Creating zip archive (ignoring node_modules)...")
    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            if 'node_modules' in dirs:
                dirs.remove('node_modules')
            if '.git' in dirs:
                dirs.remove('.git')
            if '.vite' in dirs:
                dirs.remove('.vite')
                
            for file in files:
                if file == ZIP_PATH or file.endswith('.pyc'):
                    continue
                file_path = os.path.join(root, file)
                zipf.write(file_path, arcname=os.path.relpath(file_path, '.'))
    print("Zip created.")

def run_cmd(ssh, cmd):
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    
    if out:
        try:
            print(f"STDOUT:\n{out}")
        except UnicodeEncodeError:
            print("STDOUT: [Contains Unicode]")
    if err:
        try:
            print(f"STDERR:\n{err}")
        except UnicodeEncodeError:
            print("STDERR: [Contains Unicode]")
    return out, err

def deploy():
    create_zip()
    
    print(f"Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)
    
    print("\n--- SYSTEM INSPECTION ---")
    run_cmd(ssh, "uname -a")
    run_cmd(ssh, "free -m")
    run_cmd(ssh, "df -h /")
    print("-------------------------\n")
    
    print("Installing dependencies...")
    run_cmd(ssh, "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y podman podman-compose unzip debian-keyring debian-archive-keyring apt-transport-https curl")
    
    # Install Caddy
    run_cmd(ssh, "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes")
    run_cmd(ssh, "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list")
    run_cmd(ssh, "apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y caddy")
    
    # Setup Caddyfile
    caddyfile = """hetzner.inphora.net {
    reverse_proxy /api/* localhost:3000
    reverse_proxy /socket.io/* localhost:3000
    reverse_proxy * localhost:80
}"""
    run_cmd(ssh, f"cat << 'EOF' > /etc/caddy/Caddyfile\n{caddyfile}\nEOF")
    run_cmd(ssh, "systemctl restart caddy || systemctl enable --now caddy")
    
    # Upload payload
    print("Uploading payload...")
    sftp = ssh.open_sftp()
    run_cmd(ssh, f"mkdir -p {REMOTE_DIR}")
    sftp.put(ZIP_PATH, f"{REMOTE_DIR}/payload.zip")
    sftp.close()
    
    print("Extracting and building...")
    run_cmd(ssh, f"cd {REMOTE_DIR} && unzip -o payload.zip && rm payload.zip")
    
    # Ensure Dockerfile and Compose are ready
    print("Starting podman-compose...")
    run_cmd(ssh, f"cd {REMOTE_DIR} && podman-compose build && podman-compose up -d")
    
    print("\nDeployment complete! The dashboard is being served on https://hetzner.inphora.net")
    ssh.close()
    
    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)

if __name__ == '__main__':
    deploy()
