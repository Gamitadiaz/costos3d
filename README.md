# Costos 3D

Calcula cuánto cuesta de verdad cada impresión 3D: filamento, luz, desgaste de la
impresora y refacciones. Lleva el inventario de rollos y separa lo que vendes
(ganancia) de lo que imprimes para ti (gasto).

- Arrastra el `.gcode` de OrcaSlicer y la app lee el tiempo, los gramos y el material.
- Los datos viven solo en el navegador (localStorage). Respaldo con exportar/importar JSON.
- `privado/` (fuera de git) guarda el pedido inicial; `npm run local` lo copia a `dist/`.

```
npm install
npm run dev     # para programar
npm run local   # compila y deja dist/ lista para servir
```
