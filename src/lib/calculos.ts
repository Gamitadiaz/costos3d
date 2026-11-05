import { WATTS_INICIALES, type Datos, type Impresion, type Impresora, type Rollo } from "./datos";

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
  // Tu tiempo valorado en dinero. Va aparte: no suma al costo real.
  trabajo: number;
};

export function impresoraDe(d: Datos, id?: string): Impresora | undefined {
  return d.impresoras.find((x) => x.id === id) ?? d.impresoras[0];
}

// Lo que costó una impresora más sus mejoras: es lo que se reparte como desgaste.
export function invertidoImpresora(d: Datos, imp: Impresora) {
  return imp.precio + d.gastos.filter((g) => g.categoria === "impresora" && g.impresoraId === imp.id).reduce((s, g) => s + g.monto, 0);
}

export function totalImpresoras(d: Datos) {
  return (
    d.impresoras.reduce((s, x) => s + x.precio, 0) +
    d.gastos.filter((g) => g.categoria === "impresora").reduce((s, g) => s + g.monto, 0)
  );
}

// Para que la impresión nueva salga en la impresora que usaste la última vez.
export function impresoraReciente(d: Datos) {
  const activas = d.impresoras.filter((x) => !x.retirada);
  const ultima = [...d.impresiones].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return activas.find((x) => x.id === ultima?.impresoraId) ?? activas[0];
}

function normal(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ¿El modelo que escribió el laminador ("Bambu Lab A1") es el de esta impresora?
export function esModelo(imp: Impresora, modelo: string) {
  const m = normal(modelo);
  const n = normal(imp.modelo || imp.nombre);
  return !!m && !!n && (m === n || m.includes(n) || n.includes(m));
}

// Reconoce la impresora por el modelo que el laminador escribió en el archivo. Si tienes
// dos del mismo modelo, se queda con la que ya estaba elegida.
export function impresoraPorModelo(d: Datos, modelo: string | null | undefined, actual?: string) {
  if (!modelo) return undefined;
  const iguales = d.impresoras.filter((x) => !x.retirada && esModelo(x, modelo));
  return iguales.find((x) => x.id === actual) ?? iguales[0];
}

export function precioGramo(r: Rollo | undefined) {
  return r && r.pesoG > 0 ? r.precio / r.pesoG : 0;
}

export function gramosDe(i: Pick<Impresion, "filamentos">) {
  return i.filamentos.reduce((s, u) => s + u.gramos, 0);
}

// El rollo del que salió más filamento: su material decide el consumo de luz (la temperatura de cama).
export function rolloPrincipal(d: Datos, i: Pick<Impresion, "filamentos">) {
  const mayor = [...i.filamentos].sort((a, b) => b.gramos - a.gramos)[0];
  return d.rollos.find((r) => r.id === mayor?.rolloId);
}

export function usadoRollo(d: Datos, rolloId: string, excepto?: string) {
  let total = 0;
  for (const i of d.impresiones) {
    if (i.id === excepto) continue;
    for (const u of i.filamentos) if (u.rolloId === rolloId) total += u.gramos;
  }
  return total;
}

export function restanteRollo(d: Datos, r: Rollo, excepto?: string) {
  return Math.max(0, r.pesoG - usadoRollo(d, r.id, excepto) + r.ajusteG);
}

export function costo(
  d: Datos,
  i: Pick<Impresion, "filamentos" | "impresoraId" | "minutos" | "extras" | "trabajoMin">,
): Desglose {
  const imp = impresoraDe(d, i.impresoraId);
  const horas = i.minutos / 60;
  const gramos = gramosDe(i);
  const tipo = rolloPrincipal(d, i)?.material ?? "Otro";
  const kwh = (horas * (imp?.watts[tipo] ?? WATTS_INICIALES[tipo])) / 1000;

  // Cada color se cobra al precio de su rollo.
  const material = i.filamentos.reduce((s, u) => s + u.gramos * precioGramo(d.rollos.find((r) => r.id === u.rolloId)), 0);
  const luz = kwh * d.ajustes.kwh;
  const desgaste = imp && imp.vidaH > 0 ? (horas * invertidoImpresora(d, imp)) / imp.vidaH : 0;
  const refacciones = (imp?.refacciones ?? []).reduce((s, p) => {
    if (p.vida <= 0) return s;
    const uso = p.unidad === "h" ? horas : gramos / 1000;
    return s + (p.costo / p.vida) * uso;
  }, 0);
  const extras = i.extras || 0;

  const trabajo = ((i.trabajoMin ?? 0) / 60) * d.ajustes.valorHora;

  return { material, luz, desgaste, refacciones, extras, total: material + luz + desgaste + refacciones + extras, kwh, trabajo };
}

// Qué parte de lo que gastas en piezas buenas se pierde en fallas. Si de cada $100 en
// piezas buenas pierdes $10 en fallidas, la tasa es 10 % y cada precio debe cubrirla.
export function tasaFallas(d: Datos) {
  let buenas = 0;
  let fallas = 0;
  for (const i of d.impresiones) {
    const c = costo(d, i).total;
    if (i.destino === "fallida") fallas += c;
    else buenas += c;
  }
  // Tope de 50 % para que unas cuantas fallas al principio no disparen los precios.
  return buenas > 0 ? Math.min(0.5, fallas / buenas) : 0;
}

// Precio sugerido = (costo real + tu tiempo) × (1 + tasa de fallas) × (1 + margen),
// redondeado a múltiplos de $5.
export function precioSugerido(d: Datos, c: Desglose) {
  const base = (c.total + c.trabajo) * (1 + tasaFallas(d)) * (1 + d.ajustes.margen / 100);
  return Math.ceil(base / 5) * 5;
}

export function resumen(d: Datos) {
  const r = {
    // Dinero que realmente salió de tu bolsa.
    gastado: 0,
    enImpresora: totalImpresoras(d),
    enFilamento: d.rollos.reduce((s, x) => s + x.precio, 0),
    enOtros: 0,
    luz: 0,
    // Ventas.
    ingresos: 0,
    costoVendido: 0,
    vendidas: 0,
    trabajoVentasH: 0,
    // Lo que no se vende: cuenta como gasto, nunca como ganancia.
    costoPropio: 0,
    propias: 0,
    costoFallas: 0,
    fallas: 0,
    // Uso de la máquina.
    horas: 0,
    gramos: 0,
    // Lo que cada impresión "aparta" para refacciones vs lo que de verdad se ha gastado
    // en refacciones y reparaciones.
    apartado: 0,
    enMantenimiento: 0,
    reparaciones: 0,
  };

  r.enOtros = d.gastos.filter((g) => g.categoria !== "impresora").reduce((s, g) => s + g.monto, 0);
  for (const g of d.gastos) {
    if (g.categoria === "refaccion" || g.categoria === "reparacion") r.enMantenimiento += g.monto;
    if (g.categoria === "reparacion") r.reparaciones++;
  }

  for (const i of d.impresiones) {
    const c = costo(d, i);
    r.luz += c.luz;
    r.apartado += c.refacciones;
    r.horas += i.minutos / 60;
    r.gramos += gramosDe(i);
    if (i.destino === "venta") {
      r.ingresos += i.precioVenta ?? 0;
      r.costoVendido += c.total;
      r.vendidas++;
      r.trabajoVentasH += (i.trabajoMin ?? 0) / 60;
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
    // Lo que te quedó por cada hora de tu trabajo en piezas vendidas.
    porHora: r.trabajoVentasH > 0 ? (r.ingresos - r.costoVendido) / r.trabajoVentasH : null,
    tasaFallas: tasaFallas(d),
    balance: r.ingresos - r.gastado,
    recuperado: r.gastado > 0 ? Math.min(1, r.ingresos / r.gastado) : 0,
    filamentoRestanteG,
    filamentoValor,
  };
}

// Las cuentas de cada impresora por separado: cuánto ha trabajado y cuánto deja.
export function porImpresora(d: Datos) {
  return d.impresoras.map((imp) => {
    const invertido = invertidoImpresora(d, imp);
    let horas = 0;
    let piezas = 0;
    let ingresos = 0;
    let costoVendido = 0;
    for (const i of d.impresiones) {
      if (impresoraDe(d, i.impresoraId)?.id !== imp.id) continue;
      horas += i.minutos / 60;
      piezas++;
      if (i.destino === "venta") {
        ingresos += i.precioVenta ?? 0;
        costoVendido += costo(d, i).total;
      }
    }
    const arreglos = d.gastos.filter((g) => g.impresoraId === imp.id && (g.categoria === "reparacion" || g.categoria === "refaccion"));
    return {
      imp,
      invertido,
      horas,
      piezas,
      ingresos,
      ganancia: ingresos - costoVendido,
      // Qué parte de lo que costó la impresora ya pagaron sus ventas.
      recuperado: invertido > 0 ? Math.max(0, Math.min(1, (ingresos - costoVendido) / invertido)) : 0,
      mantenimiento: arreglos.reduce((s, g) => s + g.monto, 0),
      reparaciones: arreglos.filter((g) => g.categoria === "reparacion").length,
      vidaUsada: imp.vidaH > 0 ? horas / imp.vidaH : 0,
      desgasteHora: imp.vidaH > 0 ? invertido / imp.vidaH : 0,
    };
  });
}
