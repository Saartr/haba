# Собирает веб-версию приложения и раскладывает её на apptapa.ru.
# Usage: ./deploy-web.ps1
# Файл в UTF-8 с BOM: PowerShell 5.1 иначе читает кириллицу как ANSI.
#
# Корень домена отдаёт nginx из /var/www/haba/web (см. /etc/nginx/sites-enabled/step-bot).
# API, /join/, /avatars/ и /download/ обслуживаются отдельными location и сюда не попадают.

$ErrorActionPreference = 'Stop'
$remote = '/var/www/haba/web'

Write-Host "Сборка веб-версии..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "$PSScriptRoot\dist" -ErrorAction SilentlyContinue
npx expo export --platform web
if (-not (Test-Path "$PSScriptRoot\dist\index.html")) {
    Write-Host "Сборка не создала dist/index.html — деплой отменён" -ForegroundColor Red
    exit 1
}

$size = "{0:N1} МБ" -f ((Get-ChildItem "$PSScriptRoot\dist" -Recurse | Measure-Object Length -Sum).Sum / 1MB)
Write-Host "Загрузка ($size)..." -ForegroundColor Cyan

# Заливаем в соседний каталог и меняем местами: пока идёт копирование,
# сайт продолжает отдавать предыдущую сборку целиком, а не вперемешку с новой.
ssh Tapa "rm -rf $remote.new; mkdir -p $remote.new"
scp -q -r "$PSScriptRoot\dist\*" "Tapa:$remote.new/"
ssh Tapa "rm -rf $remote.old; if [ -d $remote ]; then mv $remote $remote.old; fi; mv $remote.new $remote; rm -rf $remote.old"

Write-Host "Проверка..." -ForegroundColor Cyan
ssh Tapa "curl -sI https://apptapa.ru/ | head -1; curl -sI https://apptapa.ru/auth/yandex/callback | head -1"

Write-Host "Готово: https://apptapa.ru/" -ForegroundColor Green
