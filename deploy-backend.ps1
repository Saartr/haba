# Deploy backend to server (manual trigger)
# Usage: ./deploy-backend.ps1
# Pulls latest from main on server, installs deps if changed, restarts PM2.

$ErrorActionPreference = 'Stop'

Write-Host "Deploying backend to bot.mihmih.pro..." -ForegroundColor Cyan

ssh Haba "cd /var/www/haba && git pull --ff-only && echo done_pull"
Write-Host "--- git pull done ---"

ssh Haba "cd /var/www/haba/backend && npm install --omit=dev"
Write-Host "--- npm install done ---"

ssh Haba "pm2 restart step-bot"
Write-Host "--- pm2 restarted ---"

ssh Haba "pm2 list"

Write-Host "Done." -ForegroundColor Green
