import { useSyncExternalStore } from "react";

// Todo se guarda en el propio dispositivo (localStorage). Nada sale a internet.
// Toda la lectura/escritura pasa por este archivo: cuando la app viva en la Raspberry,
// solo hay que cambiar aquí para guardar en el servidor.

export const MATERIALES = ["PLA", "PETG", "TPU", "ABS", "Otro"] as const;
export type Material = (typeof MATERIALES)[number];

export type Rollo = {
  id: string;
  marca: string;
  nombre: string;
  material: Material;
  color: string;
  hex: string;
  pesoG: number;
  precio: number;
  fecha: string;
  // Corrección manual cuando pesas el rollo y no coincide con lo calculado.
  ajusteG: number;
  agotado?: boolean;
};

export const DESTINOS = {
  personal: "Para mí",
  venta: "Venta",
  regalo: "Regalo",
  prueba: "Prueba",
  fallida: "Fallida",
} as const;
export type Destino = keyof typeof DESTINOS;

export type Impresion = {
  id: string;
  fecha: string;
  nombre: string;
  rolloId: string;
  gramos: number;
  minutos: number;
  destino: Destino;
  precioVenta?: number;
  extras: number;
  // Minutos de TU trabajo (preparar, limpiar, empacar). No es dinero que sale de tu bolsa.
  trabajoMin?: number;
  nota?: string;
};

export const CATEGORIAS = {
  impresora: "Impresora y mejoras",
  reparacion: "Reparación / avería",
  refaccion: "Refacciones",
  herramienta: "Herramientas",
  insumo: "Insumos (pegamento, lija…)",
  otro: "Otro",
} as const;
export type Categoria = keyof typeof CATEGORIAS;

// En una reparación, "nota" guarda qué falló y cómo se arregló.
export type Gasto = { id: string; fecha: string; concepto: string; monto: number; categoria: Categoria; nota?: string };

// Piezas que se gastan con el uso: su costo se reparte entre las impresiones.
export type Refaccion = { id: string; nombre: string; costo: number; vida: number; unidad: "h" | "kg" };

export type Ajustes = {
  kwh: number;
  watts: Record<Material, number>;
  vidaImpresoraH: number;
  margen: number;
  valorHora: number;
  trabajoTipico: number;
};

export type Datos = {
  version: 1;
  rollos: Rollo[];
  impresiones: Impresion[];
  gastos: Gasto[];
  refacciones: Refaccion[];
  ajustes: Ajustes;
  ultimoRespaldo?: string;
};

// Valores de arranque. Son estimados: se cambian en Ajustes.
export const AJUSTES_INICIALES: Ajustes = {
  // Precio típico de CFE para casa, ya con IVA. Cámbialo por el de tu recibo.
  kwh: 2.5,
  // Consumo promedio de la Ender-3 V3 SE imprimiendo (la cama caliente es lo que más gasta).
  watts: { PLA: 110, PETG: 140, TPU: 120, ABS: 170, Otro: 130 },
  vidaImpresoraH: 5000,
  margen: 100,
  // Cuánto quieres ganar por cada hora de tu trabajo.
  valorHora: 50,
  // Minutos que se ponen solos en cada impresión nueva (quitarla de la cama, revisar).
  trabajoTipico: 5,
};

export const REFACCIONES_INICIALES: Refaccion[] = [
  { id: "boquilla", nombre: "Boquilla de latón 0.4", costo: 40, vida: 4, unidad: "kg" },
  { id: "cama", nombre: "Placa de impresión", costo: 350, vida: 3000, unidad: "h" },
  { id: "varios", nombre: "Tubo PTFE, bandas y ventiladores", costo: 300, vida: 2500, unidad: "h" },
];

const VACIO: Datos = {
  version: 1,
  rollos: [],
  impresiones: [],
  gastos: [],
  refacciones: REFACCIONES_INICIALES,
  ajustes: AJUSTES_INICIALES,
};

const CLAVE = "costos3d:datos";

function completar(d: Partial<Datos>): Datos {
  return {
    ...VACIO,
    ...d,
    ajustes: { ...AJUSTES_INICIALES, ...d.ajustes, watts: { ...AJUSTES_INICIALES.watts, ...d.ajustes?.watts } },
  };
}

function leer(): Datos {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? completar(JSON.parse(crudo) as Partial<Datos>) : VACIO;
  } catch {
    return VACIO;
  }
}

let datos = leer();
const oyentes = new Set<() => void>();

export function guardar(cambio: (previo: Datos) => Datos) {
  datos = cambio(datos);
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    alert("No se pudo guardar. Revisa que no esté lleno el almacenamiento del navegador.");
  }
  for (const oyente of oyentes) oyente();
}

export function useDatos() {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    () => datos,
  );
}

export function nuevoId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function hoy() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// --- Respaldo ---

export function exportar() {
  const texto = JSON.stringify(datos, null, 2);
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  enlace.download = `costos3d-${hoy()}.json`;
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  guardar((d) => ({ ...d, ultimoRespaldo: new Date().toISOString() }));
}

export function importar(texto: string) {
  const d = JSON.parse(texto) as Partial<Datos>;
  if (d.version !== 1 || !Array.isArray(d.rollos) || !Array.isArray(d.impresiones)) {
    throw new Error("El archivo no es un respaldo de Costos 3D.");
  }
  guardar(() => completar(d));
}

// Datos iniciales opcionales (tu pedido real). Viven en privado/, fuera de git, y solo
// existen cuando la app se sirve desde tu PC.
export async function buscarInicial(): Promise<string | null> {
  try {
    const r = await fetch("./inicial.json", { cache: "no-store" });
    if (!r.ok || !r.headers.get("content-type")?.includes("json")) return null;
    return await r.text();
  } catch {
    return null;
  }
}

export async function pedirPersistencia() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // No pasa nada si el navegador no lo permite.
  }
}
