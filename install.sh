
---

## 🧩 **install.sh**

```bash
#!/bin/bash
# install.sh - AI Job Application Screening Installer

echo "🚀 Starting setup..."

# Update and install dependencies
sudo apt update -y
sudo apt install -y git curl docker.io docker-compose nodejs npm

# Clone repo
if [ ! -d "ai-job-application-screening" ]; then
  git clone https://github.com/yourusername/ai-job-application-screening.git
fi

cd ai-job-application-screening || exit

# Create .env if not exists
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "⚙️  Please update your .env with actual credentials."
fi

# Install npm dependencies
npm install

# Build and start Docker
npm run docker:build
npm run docker:up

echo "✅ Setup complete!"
echo "🌐 Visit: http://localhost:3000"
