const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const entero = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

export const dinero = (n: number) => pesos.format(n);
export const numero = (n: number) => entero.format(n);

export function gramos(g: number) {
  return g >= 1000 ? `${(g / 1000).toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg` : `${numero(g)} g`;
}

export function duracion(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function fecha(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
