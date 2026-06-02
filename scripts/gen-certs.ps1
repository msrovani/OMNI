# ⚡ Generate TLS Certificates for Omni-Grid mTLS
# Requires: OpenSSL installed

$tlsDir = "$PSScriptRoot\..\tls"
New-Item -ItemType Directory -Force -Path $tlsDir | Out-Null
Set-Location $tlsDir

Write-Host "=== Generating Omni-Grid TLS Certificates ===" -ForegroundColor Cyan

# CA
Write-Host "[1/3] Generating CA..." -ForegroundColor Yellow
openssl req -x509 -newkey rsa:4096 -keyout ca.key -out ca.pem -days 3650 -nodes -subj "/O=Omni-Grid/CN=OmniGrid Root CA"

# Server cert
Write-Host "[2/3] Generating server certificate..." -ForegroundColor Yellow
openssl req -newkey rsa:2048 -keyout server.key -out server.csr -nodes -subj "/O=Omni-Grid/CN=omni-cloud.omni-grid.io"
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out server.pem -days 365 -extensions SAN -extfile <(echo "[SAN]"; echo "subjectAltName=DNS:localhost,IP:127.0.0.1")

# Device cert (Omni-Box)
Write-Host "[3/3] Generating device certificate..." -ForegroundColor Yellow
openssl req -newkey rsa:2048 -keyout device.key -out device.csr -nodes -subj "/O=Omni-Grid/CN=omni-box-sim-001"
openssl x509 -req -in device.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out device.pem -days 365

# Cleanup CSRs
Remove-Item *.csr -Force

Write-Host ""
Write-Host "=== Certificates generated ===" -ForegroundColor Green
Write-Host "  CA:     $tlsDir\ca.pem" -ForegroundColor Gray
Write-Host "  Server: $tlsDir\server.pem" -ForegroundColor Gray
Write-Host "  Device: $tlsDir\device.pem" -ForegroundColor Gray
