import type { Datos, Impresion, Rollo } from "./datos";

// Aquí está toda la matemática del costo real. Cada parte se calcula por separado
// para poder mostrar el desglose.

export type Desglose = {
  material: number;
  luz: number;
  desgaste: number;
  refacciones: number;
  extras: number;
  total: number;
  kwh: number;
};

export function totalImpresora(d: Datos) {
  return d.gastos.filter((g) => g.categoria === "impresora").reduce((s, g) => s + g.monto, 0);
}

export function precioGramo(r: Rollo | undefined) {
  return r && r.pesoG > 0 ? r.precio / r.pesoG : 0;
}

export function usadoRollo(d: Datos, rolloId: string, excepto?: string) {
  return d.impresiones.filter((i) => i.rolloId === rolloId && i.id !== excepto).reduce((s, i) => s + i.gramos, 0);
}

export function restanteRollo(d: Datos, r: Rollo, excepto?: string) {
  return Math.max(0, r.pesoG - usadoRollo(d, r.id, excepto) + r.ajusteG);
}

export function costo(d: Datos, i: Pick<Impresion, "rolloId" | "gramos" | "minutos" | "extras">): Desglose {
  const rollo = d.rollos.find((r) => r.id === i.rolloId);
  const horas = i.minutos / 60;
  const kwh = (horas * d.ajustes.watts[rollo?.material ?? "Otro"]) / 1000;

  const material = i.gramos * precioGramo(rollo);
  const luz = kwh * d.ajustes.kwh;
  const desgaste = d.ajustes.vidaImpresoraH > 0 ? (horas * totalImpresora(d)) / d.ajustes.vidaImpresoraH : 0;
  const refacciones = d.refacciones.reduce((s, p) => {
    if (p.vida <= 0) return s;
    const uso = p.unidad === "h" ? horas : i.gramos / 1000;
    return s + (p.costo / p.vida) * uso;
  }, 0);
  const extras = i.extras || 0;

  return { material, luz, desgaste, refacciones, extras, total: material + luz + desgaste + refacciones + extras, kwh };
}

export function resumen(d: Datos) {
  const r = {
    // Dinero que realmente salió de tu bolsa.
    gastado: 0,
    enImpresora: totalImpresora(d),
    enFilamento: d.rollos.reduce((s, x) => s + x.precio, 0),
    enOtros: 0,
    luz: 0,
    // Ventas.
    ingresos: 0,
    costoVendido: 0,
    vendidas: 0,
    // Lo que no se vende: cuenta como gasto, nunca como ganancia.
    costoPropio: 0,
    propias: 0,
    costoFallas: 0,
    fallas: 0,
    // Uso de la máquina.
    horas: 0,
    gramos: 0,
  };

  r.enOtros = d.gastos.filter((g) => g.categoria !== "impresora").reduce((s, g) => s + g.monto, 0);

  for (const i of d.impresiones) {
    const c = costo(d, i);
    r.luz += c.luz;
    r.horas += i.minutos / 60;
    r.gramos += i.gramos;
    if (i.destino === "venta") {
      r.ingresos += i.precioVenta ?? 0;
      r.costoVendido += c.total;
      r.vendidas++;
    } else if (i.destino === "fallida") {
      r.costoFallas += c.total;
      r.fallas++;
    } else {
      r.costoPropio += c.total;
      r.propias++;
    }
  }

  r.gastado = r.enImpresora + r.enFilamento + r.enOtros + r.luz;

  const activos = d.rollos.filter((x) => !x.agotado);
  const filamentoRestanteG = activos.reduce((s, x) => s + restanteRollo(d, x), 0);
  const filamentoValor = activos.reduce((s, x) => s + restanteRollo(d, x) * precioGramo(x), 0);

  return {
    ...r,
    ganancia: r.ingresos - r.costoVendido,
    balance: r.ingresos - r.gastado,
    recuperado: r.gastado > 0 ? Math.min(1, r.ingresos / r.gastado) : 0,
    filamentoRestanteG,
    filamentoValor,
    vidaUsada: d.ajustes.vidaImpresoraH > 0 ? r.horas / d.ajustes.vidaImpresoraH : 0,
  };
}
