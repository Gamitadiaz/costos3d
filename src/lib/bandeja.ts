import { useEffect, useState } from "react";

import type { Datos, Rollo } from "./datos";

// Impresiones que OrcaSlicer mandó al exportar (orca/registrar.py) y que esperan a que
// confirmes rollo y destino. Solo existen cuando la app la sirve servidor.py; en
// cualquier otro lado la bandeja simplemente aparece vacía.

export type Pendiente = {
  id: string;
  nombre: string;
  fecha: string;
  hora?: string;
  minutos?: number | null;
  gramos?: number | null;
  material?: string | null;
  color?: string | null;
  impresora?: string | null;
  // Cada color del archivo (impresiones multicolor); los registros viejos no lo traen.
  filamentos?: { material?: string | null; color?: string | null; gramos: number }[];
  piezas?: number | null;
};

let pendientes: Pendiente[] = [];
const oyentes = new Set<(p: Pendiente[]) => void>();

async function actualizar() {
  try {
    const r = await fetch("./api/pendientes", { cache: "no-store" });
    if (!r.ok || !r.headers.get("content-type")?.includes("json")) return;
    pendientes = (await r.json()) as Pendiente[];
    for (const o of oyentes) o(pendientes);
  } catch {
    // Sin servidor: no hay bandeja.
  }
}

export function useBandeja() {
  const [lista, setLista] = useState(pendientes);
  useEffect(() => {
    oyentes.add(setLista);
    void actualizar();
    // Revisa cada 15 s y al volver a la pestaña, por si exportaste algo en Orca.
    const reloj = setInterval(() => void actualizar(), 15000);
    const alVolver = () => document.visibilityState === "visible" && void actualizar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      oyentes.delete(setLista);
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);
  return lista;
}

export async function quitarDeBandeja(id: string) {
  pendientes = pendientes.filter((p) => p.id !== id);
  for (const o of oyentes) o(pendientes);
  try {
    await fetch("./api/pendientes/quitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([id]),
    });
  } catch {
    // Si falla, volverá a aparecer en la siguiente revisión.
  }
}

function rgb(hex: string) {
  const h = hex.replace("#", "").slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
}

// Color en Lab: ahí la distancia se parece a qué tan distintos los ve el ojo (en RGB un azul
// marino y un negro salen "cerca").
function lab(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const xyz = [
    (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
  ].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

export function diferenciaColor(a: string, b: string) {
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const esHex = (c?: string | null): c is string => !!c && /^#?[0-9a-f]{6}/i.test(c);
// Hasta esta diferencia se considera "el mismo color" (los tonos de tus rollos son aproximados).
export const PARECIDO_MAX = 22;

// El rollo del mismo material y color más parecido al del archivo; entre iguales, el que tenga menos
// filamento (para terminar primero los rollos abiertos). Si ninguno se parece de verdad (o el archivo
// no trae color), regresa undefined y te toca elegirlo: mejor preguntar que adivinar.
// excluir: rollos ya elegidos para otro color de la misma impresión.
export function rolloParecido(
  d: Datos,
  material?: string | null,
  color?: string | null,
  restante?: (r: Rollo) => number,
  excluir?: Set<string>,
) {
  if (!esHex(color)) return undefined;
  const candidatos = d.rollos.filter(
    (r) => !r.agotado && !excluir?.has(r.id) && (!material || r.material.toLowerCase() === material.toLowerCase()),
  );
  const cerca = candidatos
    .map((r) => ({ r, dif: diferenciaColor(r.hex, color) }))
    .filter((x) => x.dif <= PARECIDO_MAX)
    .sort((a, b) => a.dif - b.dif || (restante ? restante(a.r) - restante(b.r) : 0));
  return cerca[0]?.r;
}
