#!/bin/bash
set -e

echo "Setting up Hetzner Dashboard..."

# Check requirements
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 20+."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "npm is not installed."
    exit 1
fi

echo "Installing backend dependencies..."
cd backend
npm install
cd ..

echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

if [ ! -f .env ]; then
    echo "Copying .env.example to .env..."
    cp .env.example .env
    # Generate random keys
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    JWT_SECRET=$(openssl rand -base64 32)
    
    # Replace in .env for Mac/Linux compatibility
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/your_32_character_encryption_key_here/$ENCRYPTION_KEY/" .env
        sed -i '' "s/your_jwt_secret_here/$(echo $JWT_SECRET | sed -e 's/[\/&]/\\&/g')/" .env
    else
        sed -i "s/your_32_character_encryption_key_here/$ENCRYPTION_KEY/" .env
        sed -i "s/your_jwt_secret_here/$(echo $JWT_SECRET | sed -e 's/[\/&]/\\&/g')/" .env
    fi
    echo "Generated fresh ENCRYPTION_KEY and JWT_SECRET in .env"
fi

echo "Setup complete! You can now run podman-compose up -d or start the frontend/backend manually."
