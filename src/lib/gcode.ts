// Lee lo que el laminador escribe dentro del archivo: tiempo estimado, gramos, material,
// color e impresora. Sirve con .gcode (OrcaSlicer, Bambu Studio, Creality Print) y con
// .gcode.3mf de Bambu Studio / Orca, que en realidad es un ZIP.

import { leerZip } from "./zip";

// Un color del archivo: en impresiones multicolor (AMS) hay varios.
export type FilamentoGcode = { material?: string; color?: string; gramos: number };

export type DatosGcode = {
  nombre: string;
  filamentos?: FilamentoGcode[];
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

const partes = (lista?: string) => (lista ?? "").split(/[;,]/).map((x) => x.replace(/"/g, "").trim());
const primero = (lista?: string) => partes(lista)[0] || undefined;
const redondo = (g: number) => Math.round(g * 10) / 10;

// Junta las listas del laminador ("12.3,0,4.5" / "PLA;PLA;PETG" / "#FFF;#000;#F00") y deja solo los
// colores que de verdad se usaron.
function porColor(gramos?: string, tipos?: string, colores?: string): FilamentoGcode[] {
  const g = partes(gramos).map(Number);
  const t = partes(tipos);
  const c = partes(colores);
  return g
    .map((x, k) => ({ gramos: redondo(x || 0), material: t[k] || t[0] || undefined, color: c[k] || undefined }))
    .filter((x) => x.gramos > 0);
}

// Los datos van en comentarios al principio y al final del G-code.
export function datosDeTexto(texto: string): Lectura {
  const buscar = (re: RegExp) => texto.match(re)?.[1]?.trim();

  const tiempo =
    buscar(/total estimated time:\s*([^;\n]+)/i) ?? buscar(/estimated printing time \(normal mode\)\s*=\s*([^\n]+)/i);
  // Orca: "; filament used [g] = 10.2, 8.5" · Bambu Studio: "; total filament weight [g] : 10.28,8.51"
  const porColorTexto =
    buscar(/^;\s*filament used \[g\]\s*=\s*([\d.,\s]+)$/im) ?? buscar(/^;\s*total filament weight \[g\]\s*:\s*([\d.,\s]+)$/im);
  const gramos = buscar(/total filament used \[g\]\s*=\s*([\d.]+)/i) ?? porColorTexto;
  const tipos = buscar(/^;\s*filament_type\s*=\s*([^\n]+)/im);
  const colores = buscar(/^;\s*filament_colou?r\s*=\s*([^\n]+)/im);

  return {
    filamentos: porColor(porColorTexto, tipos, colores),
    minutos: tiempo ? aMinutos(tiempo) : undefined,
    // Si hay varios filamentos ("12.3,4.5") se suman.
    gramos: gramos ? Math.round(gramos.split(",").reduce((s, g) => s + Number(g || 0), 0) * 10) / 10 : undefined,
    material: primero(tipos),
    color: primero(colores),
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
    // Cada <filament> de cada placa trae su color y sus gramos; se suman por color entre placas.
    const usados = new Map<string, FilamentoGcode>();
    for (const placa of conTiempo) {
      for (const [etiqueta] of placa.matchAll(/<filament [^>]*\/?>/g)) {
        const attr = (n: string) => etiqueta.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1];
        const g = Number(attr("used_g") ?? 0);
        if (!(g > 0)) continue;
        const clave = `${attr("id")}|${attr("color")}`;
        const previo = usados.get(clave);
        usados.set(clave, { material: attr("type") || undefined, color: attr("color") || undefined, gramos: redondo((previo?.gramos ?? 0) + g) });
      }
    }
    return {
      filamentos: [...usados.values()],
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
