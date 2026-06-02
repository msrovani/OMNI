#!/usr/bin/env bash
# ⚡ Omni-Grid Edge mTLS Certificates Generator
# Uso: bash scripts/gen-edge-certs.sh
# Requer: openssl 1.1+
# Saída: edge/android-app/app/src/main/assets/{ca.pem,device.pem,device.key}

set -euo pipefail

ASSETS_DIR="$(cd "$(dirname "$0")/../edge/android-app/app/src/main/assets" && pwd)"
mkdir -p "$ASSETS_DIR"

echo "=== Gerando CA raiz ==="
openssl req -x509 -new -nodes \
  -keyout "$ASSETS_DIR/ca.key" \
  -out "$ASSETS_DIR/ca.pem" \
  -days 3650 -sha256 \
  -subj "/C=BR/O=Omni-Grid/CN=Omni-Grid Edge CA Dev"

echo "=== Gerando chave do dispositivo ==="
openssl genrsa -out "$ASSETS_DIR/device.key" 2048

echo "=== Gerando CSR do dispositivo ==="
openssl req -new \
  -key "$ASSETS_DIR/device.key" \
  -out "$ASSETS_DIR/device.csr" \
  -subj "/C=BR/O=Omni-Grid/CN=omni-box-dev-001"

echo "=== Assinando certificado do dispositivo ==="
openssl x509 -req \
  -in "$ASSETS_DIR/device.csr" \
  -CA "$ASSETS_DIR/ca.pem" \
  -CAkey "$ASSETS_DIR/ca.key" \
  -CAcreateserial \
  -out "$ASSETS_DIR/device.pem" \
  -days 1825 -sha256

# Limpeza
rm -f "$ASSETS_DIR/ca.key" "$ASSETS_DIR/device.csr" "$ASSETS_DIR/ca.srl"

echo "=== Feito ==="
echo "  ca.pem     → Trust store (CA certificate)"
echo "  device.pem → Client certificate (mTLS)"
echo "  device.key → Client private key"
ls -la "$ASSETS_DIR/"
