#!/usr/bin/env python3
"""Servidor de Costos 3D: sirve la app compilada (dist/) y la bandeja de impresiones
que manda OrcaSlicer (privado/pendientes.json).

Uso: python servidor.py <ip> 4173   (por ejemplo, la IP de Tailscale de tu PC)
Solo usa la biblioteca estándar de Python. En la Raspberry funcionará igual.
"""

import json
import os
import sys
import tempfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
BANDEJA = RAIZ / "privado" / "pendientes.json"


def leer():
    try:
        return json.loads(BANDEJA.read_text())
    except (OSError, ValueError):
        return []


def guardar(pendientes):
    fd, tmp = tempfile.mkstemp(dir=BANDEJA.parent, suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(pendientes, f, ensure_ascii=False, indent=2)
    os.replace(tmp, BANDEJA)


class Manejador(SimpleHTTPRequestHandler):
    def responder(self, datos, codigo=200):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode()
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/pendientes":
            return self.responder(leer())
        return super().do_GET()

    def do_POST(self):
        # Quita de la bandeja las impresiones ya registradas o descartadas.
        if self.path == "/api/pendientes/quitar":
            largo = min(int(self.headers.get("Content-Length") or 0), 64 * 1024)
            try:
                ids = set(json.loads(self.rfile.read(largo) or b"[]"))
            except ValueError:
                return self.responder({"error": "JSON inválido"}, 400)
            guardar([p for p in leer() if p.get("id") not in ids])
            return self.responder({"ok": True})
        self.send_error(404)


if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1"
    puerto = int(sys.argv[2]) if len(sys.argv) > 2 else 4173
    servidor = ThreadingHTTPServer((host, puerto), partial(Manejador, directory=str(RAIZ / "dist")))
    print(f"Costos 3D en http://{host}:{puerto}", flush=True)
    servidor.serve_forever()
