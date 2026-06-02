# ⚡ Omni-Grid API — Startup Script
# Execute with: powershell -ExecutionPolicy Bypass .\start-api.ps1

Write-Host "=== Omni-Grid API ===" -ForegroundColor Cyan
Write-Host "Starting API Gateway on http://localhost:3000" -ForegroundColor Yellow

Set-Location $PSScriptRoot

# Ensure pde-engine is built
if (-not (Test-Path "packages/pde-engine/dist/index.js")) {
    Write-Host "Building pde-engine..." -ForegroundColor Yellow
    Set-Location packages/pde-engine
    npx tsc
    Set-Location $PSScriptRoot
}

Write-Host "Health: http://localhost:3000/health" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Run directly (foreground)
npx tsx packages/api-gateway/src/index.ts
