// Lee lo que el laminador escribe dentro del archivo: tiempo estimado, gramos, material,
// color e impresora. Sirve con .gcode (OrcaSlicer, Bambu Studio, Creality Print) y con
// .gcode.3mf de Bambu Studio / Orca, que en realidad es un ZIP.

import { leerZip } from "./zip";

export type DatosGcode = {
  nombre: string;
  minutos?: number;
  gramos?: number;
  material?: string;
  color?: string;
  impresora?: string;
  // Un .gcode.3mf puede traer varias placas; se suman.
  placas?: number;
};

type Lectura = Omit<DatosGcode, "nombre">;

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

const primero = (lista?: string) => lista?.split(/[;,]/)[0]?.replace(/"/g, "").trim() || undefined;

// Los datos van en comentarios al principio y al final del G-code.
export function datosDeTexto(texto: string): Lectura {
  const buscar = (re: RegExp) => texto.match(re)?.[1]?.trim();

  const tiempo =
    buscar(/total estimated time:\s*([^;\n]+)/i) ?? buscar(/estimated printing time \(normal mode\)\s*=\s*([^\n]+)/i);
  const gramos =
    buscar(/total filament used \[g\]\s*=\s*([\d.]+)/i) ??
    buscar(/total filament weight \[g\]\s*:\s*([\d.]+)/i) ??
    buscar(/filament used \[g\]\s*=\s*([\d.,]+)/i);

  return {
    minutos: tiempo ? aMinutos(tiempo) : undefined,
    // Si hay varios filamentos ("12.3,4.5") se suman.
    gramos: gramos ? Math.round(gramos.split(",").reduce((s, g) => s + Number(g || 0), 0) * 10) / 10 : undefined,
    material: primero(buscar(/^;\s*filament_type\s*=\s*([^\n]+)/im)),
    color: primero(buscar(/^;\s*filament_colou?r\s*=\s*([^\n]+)/im)),
    impresora: buscar(/^;\s*printer_model\s*=\s*([^;\n]+)/im) || undefined,
  };
}

// Dentro del .3mf, slice_info.config trae el tiempo (en segundos) y los gramos de cada
// placa, y project_settings.config el modelo de la impresora.
export async function datosDe3mf(datos: ArrayBuffer): Promise<Lectura> {
  const textos = await leerZip(datos, (n) => n === "Metadata/slice_info.config" || n === "Metadata/project_settings.config");
  const info = textos.get("Metadata/slice_info.config");

  let impresora: string | undefined;
  try {
    impresora = JSON.parse(textos.get("Metadata/project_settings.config") ?? "{}").printer_model || undefined;
  } catch {
    // Sin ajustes legibles: se elige la impresora a mano.
  }

  const placas = info?.split("<plate>").slice(1) ?? [];
  const valor = (texto: string, clave: string) => texto.match(new RegExp(`key="${clave}" value="([\\d.]+)"`))?.[1];
  const conTiempo = placas.filter((p) => valor(p, "prediction"));

  if (conTiempo.length) {
    const segundos = conTiempo.reduce((s, p) => s + Number(valor(p, "prediction")), 0);
    const gramos = conTiempo.reduce((s, p) => s + Number(valor(p, "weight") ?? 0), 0);
    const filamento = info?.match(/<filament [^>]*type="([^"]*)"[^>]*color="([^"]*)"/);
    return {
      minutos: Math.round(segundos / 60),
      gramos: Math.round(gramos * 10) / 10,
      material: filamento?.[1] || undefined,
      color: filamento?.[2] || undefined,
      impresora,
      placas: conTiempo.length,
    };
  }

  // Sin slice_info: se busca el G-code de las placas dentro del ZIP.
  const gcodes = await leerZip(datos, (n) => /^Metadata\/plate_\d+\.gcode$/.test(n));
  if (!gcodes.size) {
    throw new Error("Este .3mf no está laminado. En el laminador usa «Exportar archivo de placa laminada» (.gcode.3mf).");
  }
  return { ...datosDeTexto([...gcodes.values()].join("\n")), impresora, placas: gcodes.size };
}

export async function leerArchivo(archivo: File): Promise<DatosGcode> {
  const nombre = archivo.name
    .replace(/(\.gcode)?\.3mf$|\.gcode$|\.gx$|\.g$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  // Todo ZIP empieza con "PK"; así no importa la extensión que traiga.
  const cabeza = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  if (cabeza[0] === 0x50 && cabeza[1] === 0x4b) {
    return { nombre, ...(await datosDe3mf(await archivo.arrayBuffer())) };
  }

  const inicio = await archivo.slice(0, BLOQUE).text();
  const fin = archivo.size > BLOQUE ? await archivo.slice(-BLOQUE).text() : "";
  return { nombre, ...datosDeTexto(`${inicio}\n${fin}`) };
}
