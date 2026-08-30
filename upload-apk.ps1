# Выкладывает свежий release APK на apptapa.ru (страница-заглушка на корне).
# Usage: ./upload-apk.ps1
# Сборка: cd android; ./gradlew assembleRelease  (см. память infra_dev_env)
# Сервер: Tapa (139.100.238.204, Selectel СПб)

$ErrorActionPreference = 'Stop'

$apk = "$PSScriptRoot\android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) {
    Write-Host "APK не найден: $apk" -ForegroundColor Red
    Write-Host "Сначала собери: cd android; ./gradlew assembleRelease"
    exit 1
}

$version = (Get-Content "$PSScriptRoot\app.json" -Raw | ConvertFrom-Json).expo.version
$size    = (Get-Item $apk).Length
$sizeMb  = [math]::Round($size / 1MB, 1)
$sha     = (Get-FileHash $apk -Algorithm SHA256).Hash.ToLower()
$date    = Get-Date -Format 'dd.MM.yyyy'
$dir     = '/var/www/haba/backend/public/download'

Write-Host "Версия $version, $sizeMb МБ, собран $((Get-Item $apk).LastWriteTime)" -ForegroundColor Cyan

ssh Tapa "mkdir -p $dir"

# Заливаем во временное имя и переименовываем: пока идёт закачка, со страницы
# продолжает отдаваться предыдущая сборка, а не битый файл.
Write-Host "Загрузка $sizeMb МБ..." -ForegroundColor Cyan
scp $apk "Tapa:$dir/.tapa-upload.apk"
ssh Tapa "mv $dir/.tapa-upload.apk $dir/tapa-latest.apk && chmod 644 $dir/tapa-latest.apk"

# Метаданные для страницы. Пишем после APK — если заливка упала, страница
# продолжит показывать предыдущую сборку, а не несуществующую новую.
$json = @{ version = $version; sizeMb = $sizeMb; date = $date; sha256 = $sha } | ConvertTo-Json -Compress
ssh Tapa "cat > $dir/latest.json <<'EOF'`n$json`nEOF"

Write-Host "Проверка..." -ForegroundColor Cyan
$head = ssh Tapa "curl -sI https://apptapa.ru/download/tapa-latest.apk | head -3"
$head

Write-Host "Готово: https://apptapa.ru/" -ForegroundColor Green
Write-Host "APK:    https://apptapa.ru/download/tapa-latest.apk"
Write-Host "SHA256: $sha"
