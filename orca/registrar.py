#!/usr/bin/env python3
"""OrcaSlicer ejecuta este script cada vez que exporta o envía un G-code.

Lee del archivo el tiempo estimado, los gramos, el material, el color y la impresora, y
lo agrega a la bandeja privado/pendientes.json. La app Costos 3D muestra esa bandeja para
que confirmes cada impresión. Nunca modifica el G-code y nunca hace fallar la exportación.

Configuración en Orca: Proceso → Otros → Scripts de postprocesado:
    /usr/bin/python3 /home/gama26/Proyectos/costos3d/orca/registrar.py
"""

import hashlib
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path

BANDEJA = Path(__file__).resolve().parent.parent / "privado" / "pendientes.json"
BLOQUE = 256 * 1024


def a_minutos(texto):
    total = 0.0
    hallado = False
    for n, u in re.findall(r"(\d+(?:\.\d+)?)\s*([dhms])", texto):
        hallado = True
        total += float(n) * {"d": 1440, "h": 60, "m": 1, "s": 1 / 60}[u]
    return round(total) if hallado else None


def leer_gcode(ruta):
    tam = ruta.stat().st_size
    with ruta.open("rb") as f:
        texto = f.read(BLOQUE)
        if tam > BLOQUE:
            f.seek(max(BLOQUE, tam - BLOQUE))
            texto += b"\n" + f.read()
    texto = texto.decode("utf-8", "replace")

    def buscar(patron):
        m = re.search(patron, texto, re.IGNORECASE)
        return m.group(1).strip() if m else None

    tiempo = buscar(r"total estimated time:\s*([^;\n]+)") or buscar(
        r"estimated printing time \(normal mode\)\s*=\s*([^\n]+)"
    )
    gramos = (
        buscar(r"total filament used \[g\]\s*=\s*([\d.]+)")
        or buscar(r"total filament weight \[g\]\s*:\s*([\d.]+)")
        or buscar(r"filament used \[g\]\s*=\s*([\d.,]+)")
    )
    material = buscar(r"(?m)^;\s*filament_type\s*=\s*([^;\n]+)")
    color = buscar(r"(?m)^;\s*filament_colou?r\s*=\s*([^;\n]+)")
    impresora = buscar(r"(?m)^;\s*printer_model\s*=\s*([^;\n]+)")
    # Huella del contenido: si exportas el mismo archivo dos veces, no se duplica.
    huella = hashlib.sha1(texto.encode()).hexdigest()[:16]

    return {
        "id": huella,
        "minutos": a_minutos(tiempo) if tiempo else None,
        "gramos": round(sum(float(g or 0) for g in gramos.split(",")), 1) if gramos else None,
        "material": material.split(";")[0].split(",")[0].strip() if material else None,
        "color": color.split(";")[0].split(",")[0].strip() if color else None,
        "impresora": impresora or None,
    }


def nombre_salida(ruta):
    # Orca trabaja sobre un archivo temporal; el nombre real viene en esta variable.
    nombre = os.environ.get("SLIC3R_PP_OUTPUT_NAME") or ruta.name
    nombre = Path(nombre).name
    nombre = re.sub(r"\.gcode$", "", nombre, flags=re.IGNORECASE)
    return re.sub(r"[_-]+", " ", nombre).strip() or "Sin nombre"


def guardar(pendientes):
    BANDEJA.parent.mkdir(parents=True, exist_ok=True)
    # Escribe en un temporal y luego lo renombra: así nunca queda un archivo a medias.
    fd, tmp = tempfile.mkstemp(dir=BANDEJA.parent, suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(pendientes, f, ensure_ascii=False, indent=2)
    os.replace(tmp, BANDEJA)


def main():
    ruta = Path(sys.argv[-1])
    datos = leer_gcode(ruta)
    datos["nombre"] = nombre_salida(ruta)
    datos["fecha"] = time.strftime("%Y-%m-%d")
    datos["hora"] = time.strftime("%H:%M")

    try:
        pendientes = json.loads(BANDEJA.read_text())
    except (OSError, ValueError):
        pendientes = []
    if any(p.get("id") == datos["id"] for p in pendientes):
        return
    pendientes.append(datos)
    guardar(pendientes)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001 - nunca romper la exportación de Orca
        print(f"costos3d: no se pudo registrar ({e})", file=sys.stderr)
    sys.exit(0)
