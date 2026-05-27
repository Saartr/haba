# Deploy backend to server (manual trigger)
# Usage: ./deploy-backend.ps1
# Pulls latest from main on server, installs deps if changed, restarts PM2.

$ErrorActionPreference = 'Stop'

Write-Host "Deploying backend to bot.mihmih.pro..." -ForegroundColor Cyan

ssh Haba @'
set -e
cd /var/www/haba
echo "--- git pull ---"
git pull --ff-only
echo "--- npm install ---"
cd backend
npm install --omit=dev
echo "--- pm2 restart ---"
pm2 restart step-bot
echo "--- pm2 status ---"
pm2 list
'@

Write-Host "Done." -ForegroundColor Green
