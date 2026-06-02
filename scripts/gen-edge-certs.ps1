# ⚡ Omni-Grid Edge mTLS Certificates Generator (PowerShell)
# Uso: .\scripts\gen-edge-certs.ps1
# Requer: openssl.exe no PATH ou Admin para New-SelfSignedCertificate
# Saída: edge/android-app/app/src/main/assets/{ca.pem,device.pem,device.key}

$ErrorActionPreference = "Stop"
$AssetsDir = "$PSScriptRoot/../edge/android-app/app/src/main/assets"
New-Item -ItemType Directory -Force -Path $AssetsDir | Out-Null

function Gen-OpenSSL {
    Write-Host "=== Gerando via OpenSSL ==="
    & openssl req -x509 -new -nodes `
        -keyout "$AssetsDir/ca.key" `
        -out "$AssetsDir/ca.pem" `
        -days 3650 -sha256 `
        -subj "/C=BR/O=Omni-Grid/CN=Omni-Grid Edge CA Dev"
    & openssl genrsa -out "$AssetsDir/device.key" 2048
    & openssl req -new `
        -key "$AssetsDir/device.key" `
        -out "$AssetsDir/device.csr" `
        -subj "/C=BR/O=Omni-Grid/CN=omni-box-dev-001"
    & openssl x509 -req `
        -in "$AssetsDir/device.csr" `
        -CA "$AssetsDir/ca.pem" `
        -CAkey "$AssetsDir/ca.key" `
        -CAcreateserial `
        -out "$AssetsDir/device.pem" `
        -days 1825 -sha256
    Remove-Item -Force "$AssetsDir/ca.key", "$AssetsDir/device.csr", "$AssetsDir/ca.srl" -EA 0
    Write-Host "Feito via OpenSSL"
}

function Gen-DotNet {
    Write-Host "=== Gerando via .NET (New-SelfSignedCertificate) ==="
    Write-Host "Requer PowerShell como Administrador"
    $caCert = New-SelfSignedCertificate -Type Custom `
        -KeyUsage DigitalSignature,CertSign,CRLSign `
        -KeyExportPolicy Exportable `
        -Subject "CN=Omni-Grid Edge CA Dev,O=Omni-Grid,C=BR" `
        -TextExtension "2.5.29.19={text}CA=TRUE","2.5.29.37={text}1.3.6.1.5.5.7.3.2,1.3.6.1.5.5.7.3.1" `
        -NotAfter (Get-Date).AddYears(10) `
        -KeyAlgorithm RSA -KeyLength 2048
    # Export CA PEM
    Set-Content -Path "$AssetsDir/ca.pem" -Value @"
-----BEGIN CERTIFICATE-----
$([Convert]::ToBase64String($caCert.RawData, [System.Base64FormattingOptions]::InsertLineBreaks))
-----END CERTIFICATE-----
"@
    $deviceCert = New-SelfSignedCertificate -Type Custom `
        -KeyUsage DigitalSignature `
        -KeyExportPolicy Exportable `
        -Subject "CN=omni-box-dev-001,O=Omni-Grid,C=BR" `
        -TextExtension "2.5.29.37={text}1.3.6.1.5.5.7.3.2" `
        -NotAfter (Get-Date).AddYears(5) `
        -KeyAlgorithm RSA -KeyLength 2048 `
        -Signer $caCert
    Set-Content -Path "$AssetsDir/device.pem" -Value @"
-----BEGIN CERTIFICATE-----
$([Convert]::ToBase64String($deviceCert.RawData, [System.Base64FormattingOptions]::InsertLineBreaks))
-----END CERTIFICATE-----
"@
    $rsa = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($deviceCert)
    $keyBytes = $rsa.ExportPkcs8PrivateKey()
    Set-Content -Path "$AssetsDir/device.key" -Value @"
-----BEGIN PRIVATE KEY-----
$([Convert]::ToBase64String($keyBytes, [System.Base64FormattingOptions]::InsertLineBreaks))
-----END PRIVATE KEY-----
"@
    Write-Host "Feito via .NET"
}

# Try openssl first, fall back to .NET
if (Get-Command "openssl" -EA 0) {
    Gen-OpenSSL
} else {
    Write-Host "openssl não encontrado. Tentando via .NET..."
    Write-Host "Execute como Administrador se falhar."
    try { Gen-DotNet } catch { Write-Error "Falhou: $_`nInstale openssl ou execute como Admin."; exit 1 }
}

Write-Host "=== Feito ==="
Get-ChildItem "$AssetsDir/ca.pem", "$AssetsDir/device.pem", "$AssetsDir/device.key"
