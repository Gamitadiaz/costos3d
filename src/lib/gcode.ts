// Lee lo que OrcaSlicer escribe dentro del .gcode: tiempo estimado, gramos y material.
// Esos datos están en comentarios al principio y al final del archivo, así que solo
// se leen esas partes (un G-code puede pesar decenas de MB).

export type DatosGcode = { nombre: string; minutos?: number; gramos?: number; material?: string };

const BLOQUE = 256 * 1024;

export function aMinutos(texto: string): number | undefined {
  let total = 0;
  let hallado = false;
  for (const [, n, u] of texto.matchAll(/(\d+(?:\.\d+)?)\s*([dhms])/g)) {
    hallado = true;
    total += Number(n) * { d: 1440, h: 60, m: 1, s: 1 / 60 }[u as "d" | "h" | "m" | "s"];
  }
  return hallado ? Math.round(total) : undefined;
}

export async function leerGcode(archivo: File): Promise<DatosGcode> {
  const inicio = await archivo.slice(0, BLOQUE).text();
  const fin = archivo.size > BLOQUE ? await archivo.slice(-BLOQUE).text() : "";
  const texto = `${inicio}\n${fin}`;

  const buscar = (re: RegExp) => texto.match(re)?.[1]?.trim();

  const tiempo =
    buscar(/total estimated time:\s*([^;\n]+)/i) ?? buscar(/estimated printing time \(normal mode\)\s*=\s*([^\n]+)/i);
  const gramos = buscar(/total filament used \[g\]\s*=\s*([\d.]+)/i) ?? buscar(/filament used \[g\]\s*=\s*([\d.,]+)/i);
  const material = buscar(/filament_type\s*=\s*([^;\n]+)/i);

  return {
    nombre: archivo.name.replace(/\.gcode$/i, "").replace(/[_-]+/g, " ").trim(),
    minutos: tiempo ? aMinutos(tiempo) : undefined,
    // Si hay varios filamentos ("12.3,4.5") se suman.
    gramos: gramos ? Math.round(gramos.split(",").reduce((s, g) => s + Number(g || 0), 0) * 10) / 10 : undefined,
    material: material?.split(/[;,]/)[0]?.trim(),
  };
}
