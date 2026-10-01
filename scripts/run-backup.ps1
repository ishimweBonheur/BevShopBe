$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $backendRoot
& 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'backup.js')
exit $LASTEXITCODE
