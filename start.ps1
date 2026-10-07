$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js no está instalado o no está disponible en PATH.'
}
if (-not (Test-Path (Join-Path $PSScriptRoot 'node_modules'))) {
    npm install
}
npm run build
npm start
