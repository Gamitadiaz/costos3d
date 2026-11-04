import { useState } from "react";

import { Bloque, Encabezado, Numero, Opciones, Panel, Texto } from "../componentes/basicos";
import { Icono } from "../componentes/iconos";
import { quitarDeBandeja, rolloParecido, useBandeja, type Pendiente } from "../lib/bandeja";
import { costo, restanteRollo, type Desglose } from "../lib/calculos";
import { DESTINOS, guardar, hoy, nuevoId, type Datos, type Destino, type Impresion } from "../lib/datos";
import { dinero, duracion, fecha, gramos } from "../lib/formato";
import { leerGcode } from "../lib/gcode";

type Filtro = "todas" | Destino;

export function Impresiones({ datos }: { datos: Datos }) {
  const [editando, setEditando] = useState<Impresion | null>(null);
  const [desdeOrca, setDesdeOrca] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const bandeja = useBandeja();

  function registrar(p: Pendiente) {
    const rollo = rolloParecido(datos, p.material, p.color, (r) => restanteRollo(datos, r));
    setDesdeOrca(p.id);
    setEditando({
      id: "",
      fecha: p.fecha,
      nombre: p.nombre,
      rolloId: rollo?.id ?? "",
      gramos: p.gramos ?? 0,
      minutos: p.minutos ?? 0,
      destino: "personal",
      extras: 0,
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
      rolloId: datos.rollos.find((r) => !r.agotado)?.id ?? "",
      gramos: 0,
      minutos: 0,
      destino: "personal",
      extras: 0,
    });

  return (
    <>
      <Encabezado
        accion={
          <button className="boton" disabled={!datos.rollos.length} onClick={nueva} type="button">
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
                  <i className="muestra" style={{ background: p.color ?? "#666" }} />
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
                  <button className="boton" disabled={!datos.rollos.length} onClick={() => registrar(p)} type="button">
                    Registrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Bloque>
      ) : null}

      <Opciones onCambio={setFiltro} opciones={{ todas: "Todas", ...DESTINOS }} valor={filtro} />

      {!datos.rollos.length ? <p className="vacio">Primero agrega tus rollos en Inventario.</p> : null}
      {datos.rollos.length && !lista.length ? (
        <p className="vacio">Sin impresiones aquí. Al crear una, suelta el .gcode de OrcaSlicer y se llena sola.</p>
      ) : null}

      {lista.length ? (
        <div className="tabla-marco">
          <table className="tabla">
            <thead>
              <tr>
                <th>Pieza</th>
                <th>Fecha</th>
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
                const rollo = datos.rollos.find((r) => r.id === i.rolloId);
                const ganancia = (i.precioVenta ?? 0) - c.total;
                return (
                  <tr key={i.id} onClick={() => setEditando(i)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setEditando(i)}>
                    <td>
                      <span className="pieza-nombre">
                        <i className="muestra" style={{ background: rollo?.hex ?? "#666" }} />
                        {i.nombre}
                      </span>
                    </td>
                    <td className="tenue">{fecha(i.fecha)}</td>
                    <td className="num">{duracion(i.minutos)}</td>
                    <td className="num">{gramos(i.gramos)}</td>
                    <td>
                      <span className={`chip ${i.destino}`}>{DESTINOS[i.destino]}</span>
                    </td>
                    <td className="num fuerte">{dinero(c.total)}</td>
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

export function TablaCosto({ c }: { c: Desglose }) {
  const filas: [string, number][] = [
    ["Filamento", c.material],
    [`Luz · ${c.kwh.toFixed(2)} kWh`, c.luz],
    ["Desgaste de la impresora", c.desgaste],
    ["Refacciones", c.refacciones],
    ["Extras", c.extras],
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
        <span>Costo real</span>
        <b>{dinero(c.total)}</b>
      </li>
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
  const [f, setF] = useState(inicial);
  const [aviso, setAviso] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const cambiar = (c: Partial<Impresion>) => setF((x) => ({ ...x, ...c }));

  const c = costo(datos, f);
  const rollo = datos.rollos.find((r) => r.id === f.rolloId);
  const queda = rollo ? restanteRollo(datos, rollo, f.id) : 0;
  const sugerido = Math.ceil((c.total * (1 + datos.ajustes.margen / 100)) / 5) * 5;
  const disponibles = datos.rollos.filter((r) => !r.agotado || r.id === f.rolloId);

  async function cargar(archivo: File | undefined) {
    if (!archivo) return;
    try {
      const g = await leerGcode(archivo);
      const igual = (m?: string) => !!m && m.toLowerCase() === g.material?.toLowerCase();
      cambiar({
        nombre: f.nombre || g.nombre,
        minutos: g.minutos ?? f.minutos,
        gramos: g.gramos ?? f.gramos,
        rolloId: igual(rollo?.material) ? f.rolloId : (disponibles.find((r) => igual(r.material))?.id ?? f.rolloId),
      });
      const faltan = [g.minutos === undefined && "tiempo", g.gramos === undefined && "gramos"].filter(Boolean);
      setAviso(
        faltan.length
          ? `No encontré ${faltan.join(" ni ")} en el archivo. Escríbelos a mano.`
          : `Leído: ${duracion(g.minutos ?? 0)} · ${gramos(g.gramos ?? 0)}${g.material ? ` · ${g.material}` : ""}. Revisa el rollo.`,
      );
    } catch {
      setAviso("No pude leer ese archivo.");
    }
  }

  function guardarImpresion() {
    if (!f.rolloId) return setAviso("Elige de qué rollo salió.");
    const lista: Impresion = { ...f, nombre: f.nombre.trim() || "Sin nombre", precioVenta: f.destino === "venta" ? f.precioVenta : undefined };
    guardar((d) => ({
      ...d,
      impresiones: f.id ? d.impresiones.map((x) => (x.id === f.id ? lista : x)) : [...d.impresiones, { ...lista, id: nuevoId() }],
    }));
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
          <b>Suelta aquí el .gcode</b> o haz clic para elegirlo
        </span>
        <input accept=".gcode" hidden onChange={(e) => void cargar(e.target.files?.[0])} type="file" />
      </label>
      {aviso ? <p className="aviso">{aviso}</p> : null}

      <div className="formulario">
        <div className="dos">
          <Texto etiqueta="Nombre" onCambio={(nombre) => cambiar({ nombre })} valor={f.nombre} />
          <Texto etiqueta="Fecha" onCambio={(v) => cambiar({ fecha: v })} tipo="date" valor={f.fecha} />
        </div>

        <label className="campo">
          <span>Rollo</span>
          <div className="entrada">
            <select onChange={(e) => cambiar({ rolloId: e.target.value })} value={f.rolloId}>
              {disponibles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.material} {r.color} · {r.marca} · quedan {gramos(restanteRollo(datos, r, f.id))}
                </option>
              ))}
            </select>
          </div>
        </label>
        {rollo && f.gramos > queda ? <p className="aviso">Ese rollo solo tiene {gramos(queda)} según tus registros.</p> : null}

        <div className="tres">
          <Numero etiqueta="Filamento" onCambio={(gramos) => cambiar({ gramos })} sufijo="g" valor={f.gramos} />
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
          <div className="dos abajo">
            <Numero etiqueta="Precio de venta" onCambio={(precioVenta) => cambiar({ precioVenta })} sufijo="$" valor={f.precioVenta ?? 0} />
            <button className="boton secundario" onClick={() => cambiar({ precioVenta: sugerido })} type="button">
              Sugerido {dinero(sugerido)}
            </button>
          </div>
        ) : null}

        <div className="dos">
          <Numero etiqueta="Extras (empaque, pintura…)" onCambio={(extras) => cambiar({ extras })} sufijo="$" valor={f.extras} />
          <Texto etiqueta="Nota" onCambio={(nota) => cambiar({ nota })} valor={f.nota ?? ""} />
        </div>
      </div>

      <Bloque num="Σ" titulo="Costo real">
        <TablaCosto c={c} />
        {f.destino === "venta" && f.precioVenta ? (
          <p className={f.precioVenta - c.total >= 0 ? "bien" : "mal"}>Ganancia: {dinero(f.precioVenta - c.total)}</p>
        ) : f.destino === "fallida" ? (
          <p className="mal">Fallida: este costo se pierde.</p>
        ) : f.destino !== "venta" ? (
          <p className="suave">No es venta: cuenta como gasto, no como ganancia.</p>
        ) : null}
      </Bloque>
    </Panel>
  );
}
