#!/usr/bin/env python3
"""Omni-Grid Edge mTLS Certificates Generator (Python)

Uso: python scripts/gen-edge-certs.py
Requer: pip install cryptography

Saída: edge/android-app/app/src/main/assets/{ca.pem,device.pem,device.key}
"""

import os
import subprocess
import sys

ASSETS_DIR = os.path.join(
    os.path.dirname(__file__),
    "..",
    "edge",
    "android-app",
    "app",
    "src",
    "main",
    "assets",
)


def gen_openssl():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    subprocess.run(
        [
            "openssl", "req", "-x509", "-new", "-nodes",
            "-keyout", os.path.join(ASSETS_DIR, "ca.key"),
            "-out", os.path.join(ASSETS_DIR, "ca.pem"),
            "-days", "3650", "-sha256",
            "-subj", "/C=BR/O=Omni-Grid/CN=Omni-Grid Edge CA Dev",
        ],
        check=True,
    )
    subprocess.run(
        ["openssl", "genrsa", "-out", os.path.join(ASSETS_DIR, "device.key"), "2048"],
        check=True,
    )
    subprocess.run(
        [
            "openssl", "req", "-new",
            "-key", os.path.join(ASSETS_DIR, "device.key"),
            "-out", os.path.join(ASSETS_DIR, "device.csr"),
            "-subj", "/C=BR/O=Omni-Grid/CN=omni-box-dev-001",
        ],
        check=True,
    )
    subprocess.run(
        [
            "openssl", "x509", "-req",
            "-in", os.path.join(ASSETS_DIR, "device.csr"),
            "-CA", os.path.join(ASSETS_DIR, "ca.pem"),
            "-CAkey", os.path.join(ASSETS_DIR, "ca.key"),
            "-CAcreateserial",
            "-out", os.path.join(ASSETS_DIR, "device.pem"),
            "-days", "1825", "-sha256",
        ],
        check=True,
    )
    for f in ("ca.key", "device.csr", "ca.srl"):
        p = os.path.join(ASSETS_DIR, f)
        if os.path.exists(p):
            os.remove(p)
    print("Feito via OpenSSL")


def gen_cryptography():
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.backends import default_backend
    import datetime

    os.makedirs(ASSETS_DIR, exist_ok=True)

    # CA key + cert
    ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ca_subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "BR"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Omni-Grid"),
        x509.NameAttribute(NameOID.COMMON_NAME, "Omni-Grid Edge CA Dev"),
    ])
    ca_cert = (
        x509.CertificateBuilder()
        .subject_name(ca_subject)
        .issuer_name(ca_subject)
        .public_key(ca_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow())
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, key_cert_sign=True, crl_sign=True,
                content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False,
                encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .sign(ca_key, hashes.SHA256())
    )

    with open(os.path.join(ASSETS_DIR, "ca.pem"), "wb") as f:
        f.write(ca_cert.public_bytes(serialization.Encoding.PEM))

    # Device key + cert
    dev_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    dev_subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "BR"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Omni-Grid"),
        x509.NameAttribute(NameOID.COMMON_NAME, "omni-box-dev-001"),
    ])
    dev_cert = (
        x509.CertificateBuilder()
        .subject_name(dev_subject)
        .issuer_name(ca_subject)
        .public_key(dev_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow())
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=1825))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(ca_key, hashes.SHA256())
    )

    with open(os.path.join(ASSETS_DIR, "device.pem"), "wb") as f:
        f.write(dev_cert.public_bytes(serialization.Encoding.PEM))
    with open(os.path.join(ASSETS_DIR, "device.key"), "wb") as f:
        f.write(dev_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ))

    print("Feito via cryptography")


if __name__ == "__main__":
    try:
        gen_openssl()
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("openssl não disponível. Tentando via cryptography...")
        try:
            gen_cryptography()
        except ImportError:
            print(
                "Erro: instale cryptography (`pip install cryptography`) "
                "ou openssl para gerar os certificados."
            )
            sys.exit(1)
