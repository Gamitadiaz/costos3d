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

// Cuánto filamento salió de cada rollo. Una impresión de varios colores (AMS) usa varios.
export type Uso = { rolloId: string; gramos: number };

export type Impresion = {
  id: string;
  fecha: string;
  nombre: string;
  filamentos: Uso[];
  minutos: number;
  destino: Destino;
  impresoraId: string;
  precioVenta?: number;
  extras: number;
  // Minutos de TU trabajo (preparar, limpiar, empacar). No es dinero que sale de tu bolsa.
  trabajoMin?: number;
  nota?: string;
};

export const CATEGORIAS = {
  impresora: "Mejoras",
  reparacion: "Reparación / avería",
  refaccion: "Refacciones",
  herramienta: "Herramientas",
  insumo: "Insumos (pegamento, lija…)",
  otro: "Otro",
} as const;
export type Categoria = keyof typeof CATEGORIAS;

// En una reparación, "nota" guarda qué falló y cómo se arregló. Mejoras, refacciones y
// reparaciones pueden decir de qué impresora son.
export type Gasto = {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  categoria: Categoria;
  impresoraId?: string;
  nota?: string;
};

// Piezas que se gastan con el uso: su costo se reparte entre las impresiones.
export type Refaccion = { id: string; nombre: string; costo: number; vida: number; unidad: "h" | "kg" };

// Cada impresora tiene su precio, su consumo y sus refacciones: una impresora cara se
// desgasta más caro por hora que una barata.
export type Impresora = {
  id: string;
  nombre: string;
  // Modelo tal como lo escribe el laminador en el G-code ("Creality Ender-3 V3 SE").
  // Sirve para reconocer la impresora al soltar un archivo.
  modelo: string;
  precio: number;
  fecha: string;
  vidaH: number;
  watts: Record<Material, number>;
  refacciones: Refaccion[];
  // Vendida o descompuesta: se conserva su historial, pero ya no aparece para elegir.
  retirada?: boolean;
};

export type Ajustes = {
  kwh: number;
  margen: number;
  valorHora: number;
  trabajoTipico: number;
};

export type Datos = {
  version: 3;
  impresoras: Impresora[];
  rollos: Rollo[];
  impresiones: Impresion[];
  gastos: Gasto[];
  ajustes: Ajustes;
  ultimoRespaldo?: string;
};

// Valores de arranque. Son estimados: se cambian en Ajustes.
export const AJUSTES_INICIALES: Ajustes = {
  // Precio típico de CFE para casa, ya con IVA. Cámbialo por el de tu recibo.
  kwh: 2.5,
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

// Consumo promedio de una impresora de cama caliente (la cama es lo que más gasta).
export const WATTS_INICIALES: Record<Material, number> = { PLA: 110, PETG: 140, TPU: 120, ABS: 170, Otro: 130 };

export function impresoraNueva(): Impresora {
  return {
    id: "",
    nombre: "",
    modelo: "",
    precio: 0,
    fecha: hoy(),
    vidaH: 5000,
    watts: { ...WATTS_INICIALES },
    refacciones: REFACCIONES_INICIALES.map((r) => ({ ...r })),
  };
}

const VACIO: Datos = {
  version: 3,
  impresoras: [],
  rollos: [],
  impresiones: [],
  gastos: [],
  ajustes: AJUSTES_INICIALES,
};

const CLAVE = "costos3d:datos";

// Así eran los datos en la versión 1, cuando solo había una impresora.
// En las versiones 1 y 2 cada impresión tenía un solo rollo (rolloId y gramos).
type ImpresionVieja = Omit<Impresion, "filamentos" | "impresoraId"> & {
  filamentos?: Uso[];
  impresoraId?: string;
  rolloId?: string;
  gramos?: number;
};
type DatosV1 = Partial<Omit<Datos, "version" | "ajustes" | "impresiones">> & {
  version?: 1 | 2 | 3;
  impresiones?: ImpresionVieja[];
  refacciones?: Refaccion[];
  ajustes?: Partial<Ajustes> & { watts?: Partial<Record<Material, number>>; vidaImpresoraH?: number };
};

function completar(d: DatosV1): Datos {
  // Lo que ya no se usa en la versión 2 se saca para no arrastrarlo.
  const { refacciones, ajustes: viejos, ...resto } = d;
  const { watts, vidaImpresoraH, ...ajustes } = viejos ?? {};
  let gastos = d.gastos ?? [];
  let impresiones = (d.impresiones ?? []).map(({ rolloId, gramos, ...i }) => ({
    ...i,
    impresoraId: i.impresoraId ?? "",
    filamentos: i.filamentos ?? [{ rolloId: rolloId ?? "", gramos: gramos ?? 0 }],
  }));
  let impresoras = d.impresoras;

  // De la versión 1 a la 2: la compra de la impresora (el gasto "impresora" más grande)
  // se vuelve la Impresora 1, con el consumo, la vida y las refacciones que tenía Ajustes.
  if (!impresoras) {
    const compras = gastos.filter((g) => g.categoria === "impresora");
    const compra = [...compras].sort((a, b) => b.monto - a.monto)[0];
    impresoras = [];
    if (compra || impresiones.length) {
      const id = nuevoId();
      impresoras.push({
        id,
        nombre: compra?.concepto ?? "Mi impresora",
        modelo: compra?.concepto ?? "",
        precio: compra?.monto ?? 0,
        fecha: compra?.fecha ?? hoy(),
        vidaH: vidaImpresoraH ?? 5000,
        watts: { ...WATTS_INICIALES, ...watts },
        refacciones: refacciones ?? REFACCIONES_INICIALES,
      });
      gastos = gastos
        .filter((g) => g !== compra)
        .map((g) => (["impresora", "reparacion", "refaccion"].includes(g.categoria) ? { ...g, impresoraId: id } : g));
      impresiones = impresiones.map((i) => ({ ...i, impresoraId: id }));
    }
  }

  return {
    ...VACIO,
    ...resto,
    version: 3,
    impresoras,
    gastos,
    impresiones,
    ajustes: { ...AJUSTES_INICIALES, ...ajustes },
  };
}

function leer(): Datos {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? completar(JSON.parse(crudo) as DatosV1) : VACIO;
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
  const d = JSON.parse(texto) as DatosV1;
  if (![1, 2, 3].includes(d.version ?? 0) || !Array.isArray(d.rollos) || !Array.isArray(d.impresiones)) {
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
