# ⚡ Omni-Grid API — Test Script
Write-Host "=== Testing Omni-Grid API ===" -ForegroundColor Cyan
Write-Host ""

function Test-Endpoint {
    param($Name, $Url, $Method = "GET", $Body = $null)
    try {
        if ($Body) {
            $r = Invoke-RestMethod -Uri $Url -Method $Method -Body ($Body | ConvertTo-Json) -ContentType "application/json" -UseBasicParsing
        } else {
            $r = Invoke-RestMethod -Uri $Url -Method $Method -UseBasicParsing
        }
        Write-Host "  ✓ $Name" -ForegroundColor Green
        return $r
    } catch {
        Write-Host "  ✗ $Name — $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

$base = "http://localhost:3000"

Write-Host "1. Core Health" -ForegroundColor Yellow
Test-Endpoint -Name "GET /health" -Url "$base/health"

Write-Host ""
Write-Host "2. PDE Engine" -ForegroundColor Yellow
Test-Endpoint -Name "POST /api/v1/pde/forecast" -Url "$base/api/v1/pde/forecast" -Method POST -Body @{
    assetId = "bat-001"
    horizon = 4
}

Test-Endpoint -Name "POST /api/v1/pde/optimize" -Url "$base/api/v1/pde/optimize" -Method POST -Body @{
    assetIds = @("bat-001", "bat-002")
    objective = "balanced"
    currentSoc = @{ "bat-001" = 80; "bat-002" = 60 }
}

Test-Endpoint -Name "POST /api/v1/pde/dispatch/execute" -Url "$base/api/v1/pde/dispatch/execute" -Method POST -Body @{
    assetId = "bat-001"
    powerKw = 50
    durationSeconds = 3600
    reason = "arbitrage"
}

Test-Endpoint -Name "GET /api/v1/pde/dispatch/stats" -Url "$base/api/v1/pde/dispatch/stats"

Write-Host ""
Write-Host "3. Market Data" -ForegroundColor Yellow
Test-Endpoint -Name "GET /api/v1/market/prices" -Url "$base/api/v1/market/prices"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
