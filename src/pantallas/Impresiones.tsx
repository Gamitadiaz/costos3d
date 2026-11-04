import { useState } from "react";

import { Encabezado, Numero, Opciones, Texto } from "../componentes/basicos";
import { Icono } from "../componentes/iconos";
import { costo, restanteRollo, type Desglose } from "../lib/calculos";
import { DESTINOS, guardar, hoy, nuevoId, type Datos, type Impresion } from "../lib/datos";
import { dinero, duracion, fecha, gramos } from "../lib/formato";
import { leerGcode } from "../lib/gcode";

export function Impresiones({ datos }: { datos: Datos }) {
  const [editando, setEditando] = useState<Impresion | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  if (editando) return <Formulario datos={datos} inicial={editando} onCerrar={() => setEditando(null)} />;

  const lista = [...datos.impresiones].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      <Encabezado sub="Cada pieza con su costo real" titulo="Impresiones" />

      <button
        className="boton"
        disabled={!datos.rollos.length}
        onClick={() =>
          setEditando({
            id: "",
            fecha: hoy(),
            nombre: "",
            rolloId: datos.rollos.find((r) => !r.agotado)?.id ?? "",
            gramos: 0,
            minutos: 0,
            destino: "personal",
            extras: 0,
          })
        }
        type="button"
      >
        <Icono nombre="mas" /> Nueva impresión
      </button>
      {!datos.rollos.length ? <p className="suave centro">Primero agrega tus rollos en Inventario.</p> : null}

      {lista.length === 0 && datos.rollos.length ? (
        <p className="vacio">Aún no hay impresiones. Arrastra el .gcode de OrcaSlicer al crear una y se llena sola.</p>
      ) : null}

      <ul className="lista">
        {lista.map((i) => {
          const c = costo(datos, i);
          const rollo = datos.rollos.find((r) => r.id === i.rolloId);
          const ganancia = (i.precioVenta ?? 0) - c.total;
          return (
            <li className="item" key={i.id}>
              <button className="item-cabeza" onClick={() => setAbierta(abierta === i.id ? null : i.id)} type="button">
                <i className="muestra" style={{ background: rollo?.hex ?? "#555" }} />
                <div>
                  <b>{i.nombre || "Sin nombre"}</b>
                  <small>
                    {fecha(i.fecha)} · {duracion(i.minutos)} · {gramos(i.gramos)}
                  </small>
                </div>
                <div className="item-cifra">
                  <span className={`chip ${i.destino}`}>{DESTINOS[i.destino]}</span>
                  <b>{dinero(c.total)}</b>
                </div>
              </button>
              {abierta === i.id ? (
                <div className="item-detalle">
                  <TablaCosto c={c} />
                  {i.destino === "venta" ? (
                    <p className={ganancia >= 0 ? "bien" : "mal"}>
                      Vendida en {dinero(i.precioVenta ?? 0)} → {ganancia >= 0 ? "ganaste" : "perdiste"} {dinero(Math.abs(ganancia))}
                    </p>
                  ) : i.destino === "fallida" ? (
                    <p className="mal">Fallida: este costo se perdió.</p>
                  ) : (
                    <p className="suave">No es venta: cuenta como gasto, no como ganancia.</p>
                  )}
                  {i.nota ? <p className="suave">{i.nota}</p> : null}
                  <div className="fila-botones">
                    <button className="boton secundario" onClick={() => setEditando(i)} type="button">
                      <Icono nombre="editar" /> Editar
                    </button>
                    <button
                      className="boton peligro"
                      onClick={() => {
                        if (confirm(`¿Borrar "${i.nombre}"? El filamento vuelve al rollo.`))
                          guardar((d) => ({ ...d, impresiones: d.impresiones.filter((x) => x.id !== i.id) }));
                      }}
                      type="button"
                    >
                      <Icono nombre="borrar" /> Borrar
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function TablaCosto({ c }: { c: Desglose }) {
  const filas: [string, number][] = [
    ["Filamento", c.material],
    [`Luz (${c.kwh.toFixed(2)} kWh)`, c.luz],
    ["Desgaste de la impresora", c.desgaste],
    ["Refacciones (boquilla, cama…)", c.refacciones],
    ["Extras", c.extras],
  ];
  return (
    <ul className="lista-simple">
      {filas
        .filter(([, v]) => v > 0)
        .map(([t, v]) => (
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

function Formulario({ datos, inicial, onCerrar }: { datos: Datos; inicial: Impresion; onCerrar: () => void }) {
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
      const mismo = g.material ? disponibles.find((r) => r.material.toLowerCase() === g.material?.toLowerCase()) : undefined;
      cambiar({
        nombre: f.nombre || g.nombre,
        minutos: g.minutos ?? f.minutos,
        gramos: g.gramos ?? f.gramos,
        rolloId: rollo?.material.toLowerCase() === g.material?.toLowerCase() ? f.rolloId : (mismo?.id ?? f.rolloId),
      });
      const faltan = [g.minutos === undefined && "tiempo", g.gramos === undefined && "gramos"].filter(Boolean);
      setAviso(
        faltan.length
          ? `No encontré ${faltan.join(" ni ")} en el archivo. Escríbelos a mano.`
          : `Leído: ${duracion(g.minutos ?? 0)}, ${gramos(g.gramos ?? 0)}${g.material ? `, ${g.material}` : ""}. Revisa el rollo.`,
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
    onCerrar();
  }

  return (
    <>
      <header className="encabezado con-cerrar">
        <h1>{f.id ? "Editar impresión" : "Nueva impresión"}</h1>
        <button aria-label="Cerrar" className="icono-boton" onClick={onCerrar} type="button">
          <Icono nombre="cerrar" />
        </button>
      </header>

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
        <Icono nombre="archivo" tamano={28} />
        <b>Suelta aquí el .gcode de OrcaSlicer</b>
        <small>o toca para elegirlo. Llena tiempo y gramos solo.</small>
        <input accept=".gcode" hidden onChange={(e) => void cargar(e.target.files?.[0])} type="file" />
      </label>
      {aviso ? <p className="aviso">{aviso}</p> : null}

      <section className="formulario">
        <Texto etiqueta="Nombre" onCambio={(nombre) => cambiar({ nombre })} valor={f.nombre} />
        <Texto etiqueta="Fecha" onCambio={(v) => cambiar({ fecha: v })} tipo="date" valor={f.fecha} />

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

        <div className="dos">
          <Numero etiqueta="Filamento" onCambio={(gramos) => cambiar({ gramos })} sufijo="g" valor={f.gramos} />
          <Numero etiqueta="Extras" onCambio={(extras) => cambiar({ extras })} sufijo="$" valor={f.extras} />
        </div>
        <div className="dos">
          <Numero
            etiqueta="Tiempo: horas"
            onCambio={(h) => cambiar({ minutos: Math.round(h) * 60 + (f.minutos % 60) })}
            paso="1"
            sufijo="h"
            valor={Math.floor(f.minutos / 60)}
          />
          <Numero
            etiqueta="minutos"
            onCambio={(m) => cambiar({ minutos: Math.floor(f.minutos / 60) * 60 + Math.round(m) })}
            paso="1"
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
            <Numero etiqueta="Precio de venta" onCambio={(precioVenta) => cambiar({ precioVenta })} sufijo="$" valor={f.precioVenta ?? 0} />
            <button className="boton secundario" onClick={() => cambiar({ precioVenta: sugerido })} type="button">
              Usar precio sugerido: {dinero(sugerido)} (+{datos.ajustes.margen} %)
            </button>
          </>
        ) : null}

        <Texto etiqueta="Nota (opcional)" onCambio={(nota) => cambiar({ nota })} valor={f.nota ?? ""} />
      </section>

      <section className="tarjeta">
        <h2>Costo real</h2>
        <TablaCosto c={c} />
        {f.destino === "venta" && f.precioVenta ? (
          <p className={f.precioVenta - c.total >= 0 ? "bien" : "mal"}>Ganancia: {dinero(f.precioVenta - c.total)}</p>
        ) : null}
      </section>

      <button className="boton" onClick={guardarImpresion} type="button">
        Guardar
      </button>
    </>
  );
}
