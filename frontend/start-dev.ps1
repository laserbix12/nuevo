$backendPath = Join-Path $PSScriptRoot 'backend'

Start-Process powershell -ArgumentList @(
  '-NoExit',
  '-Command',
  "Set-Location '$backendPath'; npm start"
)

Set-Location $PSScriptRoot
npm start
