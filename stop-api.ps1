# ⚡ Omni-Grid API — Stop Script
$pidFile = "$PSScriptRoot\api.pid"
if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile
    try {
        $proc = Get-Process -Id $pid -ErrorAction Stop
        $proc.Kill()
        Write-Host "API (PID $pid) stopped." -ForegroundColor Green
    } catch {
        Write-Host "Process $pid not found. Cleaning up." -ForegroundColor Yellow
    }
    Remove-Item $pidFile -Force
} else {
    Write-Host "No API PID file found." -ForegroundColor Yellow
    Write-Host "Try: Get-Process | Where-Object { `$_.ProcessName -eq 'node' } | Stop-Process" -ForegroundColor Gray
}
