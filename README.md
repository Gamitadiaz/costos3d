# Costos 3D

Calcula cuánto cuesta de verdad cada impresión 3D: filamento, luz, desgaste de la
impresora y refacciones. Lleva el inventario de rollos y separa lo que vendes
(ganancia) de lo que imprimes para ti (gasto).

**Úsala aquí:** https://gamitadiaz.github.io/costos3d/

- Varias impresoras, cada una con su precio, consumo, vida útil y refacciones.
- Arrastra el archivo laminado (`.gcode` o `.gcode.3mf` de OrcaSlicer, Bambu Studio o
  Creality Print) y la app lee el tiempo, los gramos, el material y la impresora.
- Los datos viven solo en tu navegador (localStorage): nadie más los ve. Descarga un
  respaldo de vez en cuando desde Ajustes.
- Se puede instalar como app (PWA) desde el navegador.

## Registro automático desde OrcaSlicer (opcional, en tu PC)

`orca/registrar.py` se configura en Orca (Proceso → Otros → Scripts de postprocesado):

```
/usr/bin/python3 /ruta/a/costos3d/orca/registrar.py
```

Cada G-code exportado llega a `privado/pendientes.json`, y la app lo muestra en
Impresiones → "Pendientes desde OrcaSlicer" para confirmar rollo y destino.
Para eso la app se sirve desde tu PC con `servidor.py` (solo biblioteca estándar de Python):

```
python3 servidor.py <ip> 4173
```

`privado/` (fuera de git) puede guardar un `inicial.json` con tus datos de arranque;
`npm run local` lo copia a `dist/`.

## Programar

```
npm install
npm run dev     # para programar
npm run local   # compila y deja dist/ lista para servir
```

Cada push a `main` publica la app en GitHub Pages (`.github/workflows/publicar.yml`).
