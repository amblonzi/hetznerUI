#!/bin/bash
set -e

# Usage: ./deploy-agent.sh <server-ip> <ssh-user> <ssh-key> <api-key> <dashboard-url>

SERVER_IP=$1
SSH_USER=$2
SSH_KEY=$3
API_KEY=$4
DASHBOARD_URL=$5

if [ -z "$DASHBOARD_URL" ]; then
    echo "Usage: ./deploy-agent.sh <server-ip> <ssh-user> <ssh-key> <api-key> <dashboard-url>"
    exit 1
fi

echo "Deploying agent to $SERVER_IP..."

# Create a temporary directory locally
mkdir -p /tmp/hetzner-agent

# Generate the systemd service file
cat << EOF > /tmp/hetzner-agent/hetzner-agent.service
[Unit]
Description=Hetzner Monitoring Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/hetzner-agent/agent.py
Environment="AGENT_API_KEY=$API_KEY"
Environment="DASHBOARD_URL=$DASHBOARD_URL"
Environment="SERVER_ID=$SERVER_IP"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Copy agent script and service file
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no scripts/agent.py "$SSH_USER@$SERVER_IP:/tmp/agent.py"
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no /tmp/hetzner-agent/hetzner-agent.service "$SSH_USER@$SERVER_IP:/tmp/hetzner-agent.service"

# SSH in to install and start the service
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$SERVER_IP" << 'EOF'
    sudo mkdir -p /opt/hetzner-agent
    sudo mv /tmp/agent.py /opt/hetzner-agent/agent.py
    sudo chmod +x /opt/hetzner-agent/agent.py
    sudo mv /tmp/hetzner-agent.service /etc/systemd/system/hetzner-agent.service
    sudo systemctl daemon-reload
    sudo systemctl enable hetzner-agent
    sudo systemctl restart hetzner-agent
    echo "Agent successfully deployed and started."
EOF

echo "Deployment finished for $SERVER_IP."
