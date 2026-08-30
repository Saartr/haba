# Выкладывает свежий release APK на apptapa.ru (страница-заглушка на корне).
# Usage: ./upload-apk.ps1
# Сборка: cd android; ./gradlew assembleRelease  (см. память infra_dev_env)
# Сервер: Tapa (139.100.238.204, Selectel СПб)
# Файл в UTF-8 с BOM: PowerShell 5.1 иначе читает кириллицу как ANSI и падает на парсинге.

$ErrorActionPreference = 'Stop'

$apk = Join-Path $PSScriptRoot 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path $apk)) {
    Write-Host "APK не найден: $apk" -ForegroundColor Red
    Write-Host "Сначала собери: cd android; ./gradlew assembleRelease"
    exit 1
}

$version = (Get-Content (Join-Path $PSScriptRoot 'app.json') -Raw | ConvertFrom-Json).expo.version
$item    = Get-Item $apk
$sizeMb  = [math]::Round($item.Length / 1MB, 1)
$sha     = (Get-FileHash $apk -Algorithm SHA256).Hash.ToLower()
$date    = Get-Date -Format 'dd.MM.yyyy, HH:mm'
$dir     = '/var/www/haba/backend/public/download'

Write-Host "Версия $version, $sizeMb МБ, собран $($item.LastWriteTime)" -ForegroundColor Cyan

ssh Tapa "mkdir -p $dir"

# Если на сервере ровно тот же файл, 100 МБ повторно не гоняем.
$remoteSha = (ssh Tapa "sha256sum $dir/tapa-latest.apk 2>/dev/null | cut -d' ' -f1").Trim()
if ($remoteSha -eq $sha) {
    Write-Host "На сайте уже эта сборка — обновляю только метаданные." -ForegroundColor Yellow
} else {
    # Заливаем во временное имя и переименовываем: пока идёт закачка, со страницы
    # продолжает отдаваться предыдущая сборка, а не полуфайл.
    Write-Host "Загрузка $sizeMb МБ..." -ForegroundColor Cyan
    scp $apk "Tapa:$dir/.tapa-upload.apk"
    ssh Tapa "mv $dir/.tapa-upload.apk $dir/tapa-latest.apk; chmod 644 $dir/tapa-latest.apk"
}

# Метаданные для страницы. Готовим локально и копируем файлом — так не надо
# экранировать кавычки JSON внутри ssh-команды. Пишем последними: если заливка
# упала, страница продолжит показывать предыдущую сборку, а не несуществующую.
$json    = @{ version = $version; sizeMb = $sizeMb; date = $date; sha256 = $sha } | ConvertTo-Json -Compress
$tmpJson = Join-Path $env:TEMP 'tapa-latest.json'
[System.IO.File]::WriteAllText($tmpJson, $json, (New-Object System.Text.UTF8Encoding($false)))
scp $tmpJson "Tapa:$dir/latest.json"
Remove-Item $tmpJson

Write-Host "Проверка..." -ForegroundColor Cyan
ssh Tapa "curl -sI https://apptapa.ru/download/tapa-latest.apk | head -2"

Write-Host "Готово: https://apptapa.ru/" -ForegroundColor Green
Write-Host "APK:    https://apptapa.ru/download/tapa-latest.apk"
Write-Host "SHA256: $sha"
