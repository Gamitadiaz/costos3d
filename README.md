# Costos 3D

Calcula cuánto cuesta de verdad cada impresión 3D: filamento, luz, desgaste de la
impresora y refacciones. Lleva el inventario de rollos y separa lo que vendes
(ganancia) de lo que imprimes para ti (gasto).

- Arrastra el `.gcode` de OrcaSlicer y la app lee el tiempo, los gramos y el material.
- Los datos viven solo en el navegador (localStorage). Respaldo con exportar/importar JSON.
- `privado/` (fuera de git) guarda el pedido inicial; `npm run local` lo copia a `dist/`.

## Registro automático desde OrcaSlicer

`orca/registrar.py` se configura en Orca (Proceso → Otros → Scripts de postprocesado):

```
/usr/bin/python3 /home/gama26/Proyectos/costos3d/orca/registrar.py
```

Cada G-code exportado llega a `privado/pendientes.json`, y la app lo muestra en
Impresiones → "Pendientes desde OrcaSlicer" para confirmar rollo y destino.
Para eso la app se sirve con `servidor.py` (solo biblioteca estándar de Python):

```
python3 servidor.py 100.104.45.35 4173
```

```
npm install
npm run dev     # para programar
npm run local   # compila y deja dist/ lista para servir
```
