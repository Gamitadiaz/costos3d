import { useEffect, useState } from "react";

import { Bloque, Encabezado, Numero, Opciones, Panel, Texto } from "../componentes/basicos";
import { Icono } from "../componentes/iconos";
import { quitarDeBandeja, rolloParecido, useBandeja, type Pendiente } from "../lib/bandeja";
import {
  costo,
  esModelo,
  gramosDe,
  impresoraDe,
  impresoraPorModelo,
  impresoraReciente,
  precioSugerido,
  restanteRollo,
  tasaFallas,
  type Desglose,
} from "../lib/calculos";
import { DESTINOS, guardar, hoy, nuevoId, type Datos, type Destino, type Impresion, type Uso } from "../lib/datos";
import { dinero, duracion, fecha, gramos } from "../lib/formato";
import { leerArchivo, type FilamentoGcode } from "../lib/gcode";

type Filtro = "todas" | Destino;

const TIEMPOS = { "0": "Nada", "5": "5 min", "15": "15 min", "30": "30 min", "60": "1 h", "120": "2 h" } as const;

// Borrador: lo que llevas llenado se guarda en este navegador mientras escribes, así un cierre
// accidental (clic afuera, Esc, recargar la página) no lo pierde. Se borra al guardar.
const BORRADOR = "costos3d:borrador:";
const BORRADOR_DIAS = 7;
type Borrador = { f: Impresion; colores: FilamentoGcode[]; cuando: number };

function leerBorrador(clave: string): Borrador | null {
  try {
    const b = JSON.parse(localStorage.getItem(BORRADOR + clave) ?? "null") as Borrador | null;
    return b && Date.now() - b.cuando < BORRADOR_DIAS * 864e5 ? b : null;
  } catch {
    return null;
  }
}

function escribirBorrador(clave: string, b: Borrador | null) {
  try {
    if (b) localStorage.setItem(BORRADOR + clave, JSON.stringify(b));
    else localStorage.removeItem(BORRADOR + clave);
  } catch {
    // Sin almacenamiento (ventana privada): simplemente no hay borrador.
  }
}

// A cada color del archivo le toca el rollo del mismo material y color más parecido, sin repetir
// rollo entre colores (si alcanzan los rollos).
function asignarRollos(datos: Datos, colores: FilamentoGcode[], excepto?: string): Uso[] {
  const usados = new Set<string>();
  return colores.map((x) => {
    const rollo = rolloParecido(datos, x.material, x.color, (r) => restanteRollo(datos, r, excepto), usados);
    if (rollo) usados.add(rollo.id);
    return { rolloId: rollo?.id ?? "", gramos: x.gramos };
  });
}

// Los colores que trae un pendiente de la bandeja (los registros viejos solo traen uno).
function coloresDe(p: Pendiente): FilamentoGcode[] {
  if (p.filamentos?.length) return p.filamentos.map((x) => ({ material: x.material ?? undefined, color: x.color ?? undefined, gramos: x.gramos }));
  return [{ material: p.material ?? undefined, color: p.color ?? undefined, gramos: p.gramos ?? 0 }];
}

export function Impresiones({ datos }: { datos: Datos }) {
  const [editando, setEditando] = useState<Impresion | null>(null);
  const [desdeOrca, setDesdeOrca] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const bandeja = useBandeja();

  const varias = datos.impresoras.length > 1;
  const listo = datos.rollos.length > 0 && datos.impresoras.length > 0;

  function registrar(p: Pendiente) {
    setDesdeOrca(p.id);
    setEditando({
      id: "",
      fecha: p.fecha,
      nombre: p.nombre,
      filamentos: asignarRollos(datos, coloresDe(p)),
      piezas: p.piezas && p.piezas > 1 ? p.piezas : undefined,
      impresoraId: (impresoraPorModelo(datos, p.impresora) ?? impresoraReciente(datos))?.id ?? "",
      minutos: p.minutos ?? 0,
      destino: "personal",
      extras: 0,
      trabajoMin: datos.ajustes.trabajoTipico,
    });
  }

  const lista = [...datos.impresiones]
    .filter((i) => filtro === "todas" || i.destino === filtro)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const nueva = () =>
    setEditando({
      id: "",
      fecha: hoy(),
      nombre: "",
      filamentos: [{ rolloId: datos.rollos.find((r) => !r.agotado)?.id ?? "", gramos: 0 }],
      impresoraId: impresoraReciente(datos)?.id ?? "",
      minutos: 0,
      destino: "personal",
      extras: 0,
      trabajoMin: datos.ajustes.trabajoTipico,
    });

  return (
    <>
      <Encabezado
        accion={
          <button className="boton" disabled={!listo} onClick={nueva} type="button">
            <Icono nombre="mas" /> Nueva impresión
          </button>
        }
        sub="Cada pieza con su costo real"
        titulo="Impresiones"
      />

      {bandeja.length ? (
        <Bloque clase="bandeja" num={String(bandeja.length).padStart(2, "0")} titulo="Pendientes desde OrcaSlicer">
          <p className="suave">Exportaste estos G-code. Si los imprimiste, regístralos; si no, descártalos.</p>
          <ul className="bandeja-lista">
            {bandeja.map((p) => (
              <li key={p.id}>
                <span className="pieza-nombre">
                  <Muestras colores={coloresDe(p).map((x) => x.color ?? "#666")} />
                  {p.nombre}
                </span>
                <span className="tenue">
                  {fecha(p.fecha)}
                  {p.hora ? ` · ${p.hora}` : ""}
                </span>
                <span className="num">{p.minutos != null ? duracion(p.minutos) : "—"}</span>
                <span className="num">{p.gramos != null ? gramos(p.gramos) : "—"}</span>
                <span className="chip">{p.material ?? "?"}</span>
                <div className="fila-botones">
                  <button className="boton secundario" onClick={() => void quitarDeBandeja(p.id)} type="button">
                    Descartar
                  </button>
                  <button className="boton" disabled={!listo} onClick={() => registrar(p)} type="button">
                    Registrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Bloque>
      ) : null}

      <Opciones onCambio={setFiltro} opciones={{ todas: "Todas", ...DESTINOS }} valor={filtro} />

      {!datos.impresoras.length ? <p className="vacio">Primero agrega tu impresora en Impresoras.</p> : null}
      {datos.impresoras.length && !datos.rollos.length ? <p className="vacio">Primero agrega tus rollos en Inventario.</p> : null}
      {listo && !lista.length ? (
        <p className="vacio">Sin impresiones aquí. Al crear una, suelta el archivo laminado (.gcode o .gcode.3mf) y se llena sola.</p>
      ) : null}

      {lista.length ? (
        <div className="tabla-marco">
          <table className="tabla">
            <thead>
              <tr>
                <th>Pieza</th>
                <th>Fecha</th>
                {varias ? <th>Impresora</th> : null}
                <th className="num">Tiempo</th>
                <th className="num">Filamento</th>
                <th>Destino</th>
                <th className="num">Costo real</th>
                <th className="num">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((i) => {
                const c = costo(datos, i);
                const colores = i.filamentos.map((u) => datos.rollos.find((r) => r.id === u.rolloId)?.hex ?? "#666");
                const ganancia = (i.precioVenta ?? 0) - c.total;
                return (
                  <tr key={i.id} onClick={() => setEditando(i)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEditando(i)}>
                    <td>
                      <span className="pieza-nombre">
                        <Muestras colores={colores} />
                        {i.nombre}
                        {c.piezas > 1 ? <small className="tenue">× {c.piezas}</small> : null}
                      </span>
                    </td>
                    <td className="tenue">{fecha(i.fecha)}</td>
                    {varias ? <td className="tenue">{impresoraDe(datos, i.impresoraId)?.nombre}</td> : null}
                    <td className="num">{duracion(i.minutos)}</td>
                    <td className="num">{gramos(gramosDe(i))}</td>
                    <td>
                      <span className={`chip ${i.destino}`}>{DESTINOS[i.destino]}</span>
                    </td>
                    <td className="num fuerte">
                      {dinero(c.total)}
                      {c.piezas > 1 ? <small className="tenue bloque-linea">{dinero(c.porPieza)} c/u</small> : null}
                    </td>
                    <td className={`num ${i.destino === "venta" ? (ganancia >= 0 ? "bien" : "mal") : "tenue"}`}>
                      {i.destino === "venta" ? dinero(ganancia) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {editando ? (
        <Formulario
          alGuardar={() => desdeOrca && void quitarDeBandeja(desdeOrca)}
          datos={datos}
          inicial={editando}
          onCerrar={() => {
            setEditando(null);
            setDesdeOrca(null);
          }}
        />
      ) : null}
    </>
  );
}

// Un cuadrito por color; en multicolor se enciman un poco, como los carretes del AMS.
function Muestras({ colores }: { colores: string[] }) {
  return (
    <span className="muestras">
      {colores.map((c, k) => (
        <i className="muestra" key={k} style={{ background: c }} />
      ))}
    </span>
  );
}

export function TablaCosto({ c, extrasPieza = 0 }: { c: Desglose; extrasPieza?: number }) {
  const porPieza = extrasPieza * c.piezas;
  const filas: [string, number][] = [
    ["Filamento", c.material],
    [`Luz · ${c.kwh.toFixed(2)} kWh`, c.luz],
    ["Desgaste de la impresora", c.desgaste],
    ["Refacciones", c.refacciones],
    ...(porPieza ? ([[`Extras por pieza · ${c.piezas} × ${dinero(extrasPieza)}`, porPieza]] as [string, number][]) : []),
    [porPieza ? "Extras del lote" : "Extras", c.extras - porPieza],
  ];
  return (
    <ul className="lista-simple">
      {filas.map(([t, v]) => (
        <li key={t}>
          <span>{t}</span>
          <b>{dinero(v)}</b>
        </li>
      ))}
      <li className="total">
        <span>{c.piezas > 1 ? `Costo real del lote (${c.piezas} piezas)` : "Costo real"}</span>
        <b>{dinero(c.total)}</b>
      </li>
      {c.piezas > 1 ? (
        <li className="total">
          <span>Costo real por pieza</span>
          <b>{dinero(c.porPieza)}</b>
        </li>
      ) : null}
      {c.trabajo > 0 ? (
        <li className="aparte">
          <span>+ Tu tiempo (no es gasto, se cobra al vender)</span>
          <b>{dinero(c.trabajo)}</b>
        </li>
      ) : null}
    </ul>
  );
}

function Formulario({
  datos,
  inicial,
  onCerrar,
  alGuardar,
}: {
  datos: Datos;
  inicial: Impresion;
  onCerrar: () => void;
  alGuardar?: () => void;
}) {
  const claveBorrador = inicial.id || `nueva:${inicial.nombre}`;
  const [borrador] = useState(() => leerBorrador(claveBorrador));
  const [f, setF] = useState(borrador?.f ?? inicial);
  const [recuperado, setRecuperado] = useState(!!borrador);
  const [aviso, setAviso] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  // Modelo de impresora que venía en el archivo, para avisar si no cuadra con la elegida.
  const [modeloArchivo, setModeloArchivo] = useState<string>();
  const cambiar = (c: Partial<Impresion>) => setF((x) => ({ ...x, ...c }));

  // Colores que venían en el archivo, para mostrarlos junto a cada fila.
  const [coloresArchivo, setColoresArchivo] = useState<FilamentoGcode[]>(borrador?.colores ?? []);

  // Cada cambio se guarda como borrador; si quedó igual a como se abrió, no hace falta.
  useEffect(() => {
    const igual = JSON.stringify(f) === JSON.stringify(inicial);
    escribirBorrador(claveBorrador, igual ? null : { f, colores: coloresArchivo, cuando: Date.now() });
  }, [f, coloresArchivo]);
  const cambiarUso = (k: number, c: Partial<Uso>) => cambiar({ filamentos: f.filamentos.map((u, n) => (n === k ? { ...u, ...c } : u)) });

  const c = costo(datos, f);
  const sugerido = precioSugerido(datos, c);
  const precioPor = c.piezas > 1 ? (f.precioPor ?? "pieza") : "lote";
  const ganancia = (f.precioVenta ?? 0) - c.total;
  const fallas = tasaFallas(datos);
  const disponibles = datos.rollos.filter((r) => !r.agotado || f.filamentos.some((u) => u.rolloId === r.id));
  const maquinas = datos.impresoras.filter((x) => !x.retirada || x.id === f.impresoraId);
  const elegida = impresoraDe(datos, f.impresoraId);
  const noCuadra = modeloArchivo && elegida && !esModelo(elegida, modeloArchivo);

  async function cargar(archivo: File | undefined) {
    if (!archivo) return;
    try {
      const g = await leerArchivo(archivo);
      const maquina = impresoraPorModelo(datos, g.impresora, f.impresoraId);
      // Un color por fila; si el archivo no los separa, una sola fila con el total.
      const colores = g.filamentos?.length ? g.filamentos : g.gramos !== undefined ? [{ material: g.material, color: g.color, gramos: g.gramos }] : [];
      cambiar({
        impresoraId: maquina?.id ?? f.impresoraId,
        nombre: f.nombre || g.nombre,
        minutos: g.minutos ?? f.minutos,
        ...(colores.length ? { filamentos: asignarRollos(datos, colores, f.id) } : {}),
        ...(g.piezas && g.piezas > 1 ? { piezas: g.piezas } : {}),
      });
      setColoresArchivo(colores);
      setModeloArchivo(g.impresora);
      const faltan = [g.minutos === undefined && "tiempo", !colores.length && "gramos"].filter(Boolean);
      const placas = g.placas && g.placas > 1 ? ` · ${g.placas} placas sumadas` : "";
      const cuantos = (colores.length > 1 ? ` en ${colores.length} colores` : "") + (g.piezas && g.piezas > 1 ? ` · ${g.piezas} piezas` : "");
      setAviso(
        faltan.length
          ? `No encontré ${faltan.join(" ni ")} en el archivo. Escríbelos a mano.`
          : `Leído: ${duracion(g.minutos ?? 0)} · ${gramos(gramosDe({ filamentos: colores.map((x) => ({ rolloId: "", gramos: x.gramos })) }))}${cuantos}${placas}. Revisa que cada color tenga su rollo${g.piezas && g.piezas > 1 ? "" : " y cuántas piezas salen"}.`,
      );
    } catch (e) {
      setAviso(e instanceof Error && e.message.endsWith(".") ? e.message : "No pude leer ese archivo.");
    }
  }

  function guardarImpresion() {
    const filamentos = f.filamentos.filter((u) => u.rolloId || u.gramos > 0);
    if (!filamentos.length || filamentos.some((u) => !u.rolloId)) return setAviso("Elige de qué rollo salió cada color.");
    const lista: Impresion = { ...f, filamentos, nombre: f.nombre.trim() || "Sin nombre", precioVenta: f.destino === "venta" ? f.precioVenta : undefined };
    guardar((d) => ({
      ...d,
      impresiones: f.id ? d.impresiones.map((x) => (x.id === f.id ? lista : x)) : [...d.impresiones, { ...lista, id: nuevoId() }],
    }));
    escribirBorrador(claveBorrador, null);
    alGuardar?.();
    onCerrar();
  }

  return (
    <Panel
      onCerrar={onCerrar}
      pie={
        <>
          {f.id ? (
            <button
              aria-label="Borrar impresión"
              className="icono-boton peligro"
              onClick={() => {
                if (confirm(`¿Borrar "${f.nombre}"? El filamento vuelve al rollo.`)) {
                  guardar((d) => ({ ...d, impresiones: d.impresiones.filter((x) => x.id !== f.id) }));
                  escribirBorrador(claveBorrador, null);
                  onCerrar();
                }
              }}
              type="button"
            >
              <Icono nombre="borrar" />
            </button>
          ) : null}
          <button className="boton" onClick={guardarImpresion} type="button">
            Guardar · {dinero(c.total)}
          </button>
        </>
      }
      titulo={f.id ? "Editar impresión" : "Nueva impresión"}
    >
      <label
        className={`soltar ${arrastrando ? "activo" : ""}`}
        onDragLeave={() => setArrastrando(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          void cargar(e.dataTransfer.files[0]);
        }}
      >
        <Icono nombre="archivo" tamano={24} />
        <span>
          <b>Suelta aquí el archivo laminado</b> (.gcode o .gcode.3mf) o haz clic para elegirlo
        </span>
        <input accept=".gcode,.3mf,.gx,.g" hidden onChange={(e) => void cargar(e.target.files?.[0])} type="file" />
      </label>
      {recuperado ? (
        <p className="aviso recuperado">
          Recuperé lo que estabas llenando{borrador ? ` (${new Date(borrador.cuando).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })})` : ""}.
          <button
            className="enlace"
            onClick={() => {
              setF(inicial);
              setColoresArchivo([]);
              setRecuperado(false);
            }}
            type="button"
          >
            Empezar de cero
          </button>
        </p>
      ) : null}
      {aviso ? <p className="aviso">{aviso}</p> : null}

      <div className="formulario">
        <div className="dos">
          <Texto etiqueta="Nombre" onCambio={(nombre) => cambiar({ nombre })} valor={f.nombre} />
          <Texto etiqueta="Fecha" onCambio={(v) => cambiar({ fecha: v })} tipo="date" valor={f.fecha} />
        </div>
        <div className="dos">
          <Numero
            etiqueta="Piezas en esta impresión"
            onCambio={(n) => cambiar({ piezas: Math.max(1, Math.round(n)) })}
            sufijo="pzs"
            valor={f.piezas ?? 1}
          />
          <Numero
            etiqueta="Extra por pieza (NFC, argolla…)"
            onCambio={(extrasPieza) => cambiar({ extrasPieza })}
            sufijo="$"
            valor={f.extrasPieza ?? 0}
          />
        </div>

        {maquinas.length > 1 ? (
          <div className="campo">
            <span>Impresora</span>
            <Opciones
              onCambio={(impresoraId) => cambiar({ impresoraId })}
              opciones={Object.fromEntries(maquinas.map((x) => [x.id, x.nombre]))}
              valor={f.impresoraId}
            />
          </div>
        ) : null}

        {noCuadra && elegida ? (
          <p className="aviso">
            Este archivo es para una <b>{modeloArchivo}</b>, pero elegiste <b>{elegida.nombre}</b>
            {elegida.modelo ? ` (${elegida.modelo})` : ""}. Si de verdad la imprimiste ahí, está bien; si no, cambia la impresora.
            {!impresoraPorModelo(datos, modeloArchivo) ? " Ninguna de tus impresoras tiene ese modelo: revísalo en Impresoras." : ""}
          </p>
        ) : null}

        <div className="campo">
          <span>{f.filamentos.length > 1 ? `Filamentos · ${f.filamentos.length} colores, ${gramos(gramosDe(f))}` : "Filamento"}</span>
          {f.filamentos.map((u, k) => {
            const rollo = datos.rollos.find((r) => r.id === u.rolloId);
            const queda = rollo ? restanteRollo(datos, rollo, f.id) - f.filamentos.filter((x, n) => n < k && x.rolloId === u.rolloId).reduce((s, x) => s + x.gramos, 0) : 0;
            const delArchivo = coloresArchivo[k];
            return (
              <div key={k}>
                <div className="fila-filamento">
                  <span className="par-muestras" title={delArchivo ? `En el archivo: ${delArchivo.material ?? ""} ${delArchivo.color ?? ""}` : undefined}>
                    {delArchivo?.color ? <i className="muestra" style={{ background: delArchivo.color.slice(0, 7) }} /> : null}
                    <i className="muestra grande" style={{ background: rollo?.hex ?? "#666" }} />
                  </span>
                  <div className="entrada">
                    <select aria-label={`Rollo del color ${k + 1}`} onChange={(e) => cambiarUso(k, { rolloId: e.target.value })} value={u.rolloId}>
                      {!u.rolloId ? <option value="">Elige el rollo…</option> : null}
                      {disponibles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.material} {r.color} · {r.marca} · quedan {gramos(restanteRollo(datos, r, f.id))}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Numero etiqueta="" onCambio={(g) => cambiarUso(k, { gramos: g })} sufijo="g" valor={u.gramos} />
                  {f.filamentos.length > 1 ? (
                    <button
                      aria-label="Quitar este color"
                      className="icono-boton"
                      onClick={() => cambiar({ filamentos: f.filamentos.filter((_, n) => n !== k) })}
                      type="button"
                    >
                      <Icono nombre="cerrar" />
                    </button>
                  ) : null}
                </div>
                {!u.rolloId && delArchivo ? (
                  <p className="aviso">
                    {delArchivo.color ? <i className="muestra" style={{ background: delArchivo.color.slice(0, 7) }} /> : null} No tienes un rollo
                    de {delArchivo.material ?? "este material"} parecido a este color{delArchivo.color ? ` (${delArchivo.color.slice(0, 7)})` : ""}. Elige
                    cuál usaste o agrégalo en Inventario.
                  </p>
                ) : null}
                {rollo && u.gramos > queda ? <p className="aviso">Ese rollo solo tiene {gramos(Math.max(0, queda))} según tus registros.</p> : null}
              </div>
            );
          })}
          <button
            className="enlace"
            onClick={() => cambiar({ filamentos: [...f.filamentos, { rolloId: "", gramos: 0 }] })}
            type="button"
          >
            + Otro color
          </button>
        </div>

        <div className="dos">
          <Numero
            etiqueta="Horas"
            onCambio={(h) => cambiar({ minutos: Math.round(h) * 60 + (f.minutos % 60) })}
            sufijo="h"
            valor={Math.floor(f.minutos / 60)}
          />
          <Numero
            etiqueta="Minutos"
            onCambio={(m) => cambiar({ minutos: Math.floor(f.minutos / 60) * 60 + Math.round(m) })}
            sufijo="min"
            valor={f.minutos % 60}
          />
        </div>

        <div className="campo">
          <span>¿Para qué es?</span>
          <Opciones onCambio={(destino) => cambiar({ destino })} opciones={DESTINOS} valor={f.destino} />
        </div>

        {f.destino === "venta" ? (
          <>
            {c.piezas > 1 ? (
              <div className="campo">
                <span>Escribir el precio</span>
                <Opciones onCambio={(v) => cambiar({ precioPor: v })} opciones={{ pieza: "Por pieza", lote: "Del lote completo" }} valor={precioPor} />
              </div>
            ) : null}
            <div className="dos abajo">
              <Numero
                etiqueta={precioPor === "pieza" ? "Precio de venta por pieza" : c.piezas > 1 ? `Precio del lote (${c.piezas} piezas)` : "Precio de venta"}
                onCambio={(v) => cambiar({ precioVenta: precioPor === "pieza" ? Math.round(v * c.piezas * 100) / 100 : v })}
                sufijo="$"
                valor={precioPor === "pieza" ? Math.round(((f.precioVenta ?? 0) / c.piezas) * 100) / 100 : (f.precioVenta ?? 0)}
              />
              <button className="boton secundario" onClick={() => cambiar({ precioVenta: sugerido.lote })} type="button">
                Sugerido {c.piezas > 1 ? `${dinero(sugerido.pieza)} c/u` : dinero(sugerido.lote)}
              </button>
            </div>
          </>
        ) : null}

        <div className="campo">
          <span>Tu tiempo de trabajo (preparar, limpiar, empacar) — aproximado está bien</span>
          <div className="fila-trabajo">
            <Opciones
              onCambio={(v) => cambiar({ trabajoMin: Number(v) })}
              opciones={TIEMPOS}
              valor={String(f.trabajoMin ?? 0) as keyof typeof TIEMPOS}
            />
            <div className="trabajo-otro">
              <Numero etiqueta="" onCambio={(trabajoMin) => cambiar({ trabajoMin: Math.round(trabajoMin) })} sufijo="min" valor={f.trabajoMin ?? 0} />
            </div>
          </div>
        </div>

        <div className="dos">
          <Numero etiqueta="Extras del lote (empaque, pintura…)" onCambio={(extras) => cambiar({ extras })} sufijo="$" valor={f.extras} />
          <Texto etiqueta="Nota" onCambio={(nota) => cambiar({ nota })} valor={f.nota ?? ""} />
        </div>
      </div>

      <Bloque num="Σ" titulo="Costo real">
        <TablaCosto c={c} extrasPieza={f.extrasPieza ?? 0} />
        {f.destino === "venta" ? (
          <p className="suave">
            Sugerido {c.piezas > 1 ? `${dinero(sugerido.pieza)} por pieza (${dinero(sugerido.lote)} el lote)` : dinero(sugerido.lote)} = (costo + tu
            tiempo){fallas > 0 ? ` + ${Math.round(fallas * 100)} % por fallas` : ""} + {datos.ajustes.margen} % de margen.
          </p>
        ) : null}
        {f.destino === "venta" && f.precioVenta ? (
          <p className={ganancia >= 0 ? "bien" : "mal"}>
            Ganancia: {dinero(ganancia)}
            {c.piezas > 1 ? ` (${dinero(ganancia / c.piezas)} por pieza)` : ""}
            {f.trabajoMin ? ` · ${dinero((ganancia / f.trabajoMin) * 60)} por hora de tu trabajo` : ""}
          </p>
        ) : f.destino === "fallida" ? (
          <p className="mal">Fallida: este costo se pierde.</p>
        ) : f.destino !== "venta" ? (
          <p className="suave">No es venta: cuenta como gasto, no como ganancia.</p>
        ) : null}
      </Bloque>
    </Panel>
  );
}
