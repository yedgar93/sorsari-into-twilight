#!/usr/bin/env python3
"""
Simple HTTPS server for local development
Generates a self-signed certificate and serves files over HTTPS
"""

import http.server
import ssl
import os
import subprocess

# Generate self-signed certificate if it doesn't exist
if not os.path.exists('cert.pem') or not os.path.exists('key.pem'):
    print("Generating self-signed certificate...")
    subprocess.run([
        'openssl', 'req', '-new', '-x509', '-keyout', 'key.pem', '-out', 'cert.pem',
        '-days', '365', '-nodes', '-subj', '/CN=localhost'
    ])
    print("Certificate generated!")

# Create HTTPS server
server_address = ('0.0.0.0', 8443)
httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)

# Wrap with SSL
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('cert.pem', 'key.pem')
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"\n🔒 HTTPS Server running at:")
print(f"   https://localhost:8443")
print(f"   https://192.168.0.208:8443")
print(f"\n⚠️  You'll need to accept the self-signed certificate warning in your browser")
print(f"   On iOS: Tap 'Advanced' → 'Proceed to website'\n")

httpd.serve_forever()

