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

// Elige el rollo con el mismo material y el color más parecido al que tenía Orca;
// entre iguales, el que tenga menos filamento (para terminar primero los rollos abiertos).
export function rolloParecido(d: Datos, material?: string | null, color?: string | null, restante?: (r: Rollo) => number) {
  const activos = d.rollos.filter((r) => !r.agotado);
  const mismos = activos.filter((r) => material && r.material.toLowerCase() === material.toLowerCase());
  const candidatos = mismos.length ? mismos : activos;
  if (!candidatos.length) return undefined;
  const objetivo = color && /^#?[0-9a-f]{6}/i.test(color) ? rgb(color) : null;
  const distancia = (r: Rollo) => (objetivo ? rgb(r.hex).reduce((s, v, i) => s + (v - objetivo[i]) ** 2, 0) : 0);
  return [...candidatos].sort((a, b) => distancia(a) - distancia(b) || (restante ? restante(a) - restante(b) : 0))[0];
}
