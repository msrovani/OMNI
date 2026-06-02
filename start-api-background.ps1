# ⚡ Omni-Grid API — Background Startup Script
# Starts the API in a hidden PowerShell window
# Access at http://localhost:3000

$apiDir = $PSScriptRoot
$logFile = "$apiDir\api.log"

Write-Host "Starting Omni-Grid API in background..." -ForegroundColor Cyan
Write-Host "PID file: $apiDir\api.pid" -ForegroundColor Gray
Write-Host "Log file: $logFile" -ForegroundColor Gray
Write-Host "Health: http://localhost:3000/health" -ForegroundColor Green
Write-Host ""
Write-Host "To stop: .\stop-api.ps1" -ForegroundColor Yellow

# Start hidden PowerShell window
$arg = "-NoProfile -NoLogo -Command `"Set-Location '$apiDir'; npx tsx packages/api-gateway/src/index.ts *>'$logFile'`""
$p = Start-Process -WindowStyle Hidden -FilePath "powershell.exe" -ArgumentList $arg -PassThru
$p.Id | Out-File "$apiDir\api.pid"

Write-Host "API started (PID: $($p.Id))" -ForegroundColor Green
