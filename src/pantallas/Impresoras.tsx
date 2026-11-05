import { useState } from "react";

import { Barra, Bloque, Encabezado, Numero, Opciones, Panel, Texto } from "../componentes/basicos";
import { Icono } from "../componentes/iconos";
import { invertidoImpresora, porImpresora } from "../lib/calculos";
import { guardar, impresoraNueva, MATERIALES, nuevoId, type Datos, type Impresora, type Refaccion } from "../lib/datos";
import { dinero, numero } from "../lib/formato";

// Nombres tal como los escriben OrcaSlicer y Bambu Studio en el G-code (printer_model).
const MODELOS = [
  "Creality Ender-3 V3 SE",
  "Creality Ender-3 V3 KE",
  "Creality K1C",
  "Bambu Lab A1 mini",
  "Bambu Lab A1",
  "Bambu Lab P1S",
  "Bambu Lab X1 Carbon",
  "Flashforge Adventurer 5M",
  "Flashforge Adventurer 5M Pro",
  "Flashforge AD5X",
  "Prusa MK4S",
];

export function Impresoras({ datos }: { datos: Datos }) {
  const [editando, setEditando] = useState<Impresora | null>(null);
  const [verRetiradas, setVerRetiradas] = useState(false);
  const cuentas = porImpresora(datos).filter((c) => verRetiradas || !c.imp.retirada);
  const retiradas = datos.impresoras.filter((x) => x.retirada).length;

  return (
    <>
      <Encabezado
        accion={
          <button className="boton" onClick={() => setEditando(impresoraNueva())} type="button">
            <Icono nombre="mas" /> Agregar impresora
          </button>
        }
        sub="Cada máquina con su desgaste, su consumo y lo que genera"
        titulo="Impresoras"
      />

      {!datos.impresoras.length ? <p className="vacio">Agrega tu primera impresora: con su precio se calcula el desgaste.</p> : null}

      <div className="rejilla">
        {cuentas.map((c, n) => (
          <Bloque
            accion={
              <button aria-label={`Editar ${c.imp.nombre}`} className="icono-boton" onClick={() => setEditando(c.imp)} type="button">
                <Icono nombre="editar" />
              </button>
            }
            clase={`ancho-6 maquina ${c.imp.retirada ? "retirada" : ""}`}
            key={c.imp.id}
            num={String(n + 1).padStart(2, "0")}
            titulo={c.imp.retirada ? "Retirada" : "Impresora"}
          >
            <div className="maquina-nombre">
              <b>{c.imp.nombre}</b>
              {c.imp.modelo && c.imp.modelo !== c.imp.nombre ? <small>{c.imp.modelo}</small> : null}
            </div>
            <div className="dos-cifras">
              <div>
                <span>Invertido</span>
                <b>{dinero(c.invertido)}</b>
              </div>
              <div>
                <span>Recuperado con ventas</span>
                <b className={c.recuperado > 0 ? "bien" : ""}>{numero(c.recuperado * 100)} %</b>
              </div>
            </div>
            <div>
              <div className="maquina-vida">
                <span>Vida usada</span>
                <span className="tenue">
                  {numero(c.horas)} de {numero(c.imp.vidaH)} h
                </span>
              </div>
              <Barra tono={c.vidaUsada > 0.8 ? "aviso" : undefined} valor={c.vidaUsada} />
            </div>
            <ul className="lista-simple">
              <li>
                <span>Piezas impresas</span>
                <b>{c.piezas}</b>
              </li>
              <li>
                <span>Desgaste por hora</span>
                <b>{dinero(c.desgasteHora)}</b>
              </li>
              <li>
                <span>Ganancia en ventas</span>
                <b className={c.ganancia > 0 ? "bien" : c.ganancia < 0 ? "mal" : ""}>{dinero(c.ganancia)}</b>
              </li>
              <li>
                <span>Refacciones y reparaciones{c.reparaciones ? ` · ${c.reparaciones} avería(s)` : ""}</span>
                <b>{dinero(c.mantenimiento)}</b>
              </li>
            </ul>
          </Bloque>
        ))}
      </div>

      {retiradas ? (
        <button className="enlace" onClick={() => setVerRetiradas(!verRetiradas)} type="button">
          {verRetiradas ? "Ocultar retiradas" : `Ver ${retiradas} impresora(s) retirada(s)`}
        </button>
      ) : null}

      {editando ? <FormImpresora datos={datos} inicial={editando} onCerrar={() => setEditando(null)} /> : null}
    </>
  );
}

function FormImpresora({ datos, inicial, onCerrar }: { datos: Datos; inicial: Impresora; onCerrar: () => void }) {
  const [f, setF] = useState(inicial);
  const cambiar = (c: Partial<Impresora>) => setF((x) => ({ ...x, ...c }));
  const cambiarPieza = (id: string, c: Partial<Refaccion>) =>
    cambiar({ refacciones: f.refacciones.map((p) => (p.id === id ? { ...p, ...c } : p)) });
  const usada = datos.impresiones.some((i) => i.impresoraId === f.id);
  const invertido = f.id ? invertidoImpresora(datos, f) : f.precio;

  function guardarImpresora() {
    const lista = { ...f, nombre: f.nombre.trim(), modelo: f.modelo.trim() };
    guardar((d) => ({
      ...d,
      impresoras: f.id ? d.impresoras.map((x) => (x.id === f.id ? lista : x)) : [...d.impresoras, { ...lista, id: nuevoId() }],
    }));
    onCerrar();
  }

  return (
    <Panel
      onCerrar={onCerrar}
      pie={
        <>
          {f.id ? (
            <button
              aria-label="Borrar impresora"
              className="icono-boton peligro"
              disabled={usada}
              onClick={() => {
                if (confirm(`¿Borrar "${f.nombre}"?`)) {
                  guardar((d) => ({ ...d, impresoras: d.impresoras.filter((x) => x.id !== f.id) }));
                  onCerrar();
                }
              }}
              title={usada ? "Tiene impresiones; mejor márcala como retirada" : "Borrar"}
              type="button"
            >
              <Icono nombre="borrar" />
            </button>
          ) : null}
          <button className="boton" disabled={!f.nombre.trim()} onClick={guardarImpresora} type="button">
            Guardar
          </button>
        </>
      }
      titulo={f.id ? "Editar impresora" : "Nueva impresora"}
    >
      <div className="formulario">
        <datalist id="modelos">
          {MODELOS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="dos">
          <Texto etiqueta="Nombre (para identificarla)" onCambio={(nombre) => cambiar({ nombre })} valor={f.nombre} />
          <Texto etiqueta="Modelo" lista="modelos" onCambio={(modelo) => cambiar({ modelo })} valor={f.modelo} />
        </div>
        <p className="suave">
          Escribe el modelo como aparece en tu laminador (Orca o Bambu Studio): así, al soltar un .gcode, la app reconoce en qué
          impresora se imprimió.
        </p>
        <div className="tres">
          <Numero etiqueta="Precio" onCambio={(precio) => cambiar({ precio })} sufijo="$" valor={f.precio} />
          <Texto etiqueta="Compra" onCambio={(v) => cambiar({ fecha: v })} tipo="date" valor={f.fecha} />
          <Numero etiqueta="Vida útil" onCambio={(vidaH) => cambiar({ vidaH })} sufijo="h" valor={f.vidaH} />
        </div>
        <p className="suave">
          Cada hora impresa cuesta {dinero(f.vidaH ? invertido / f.vidaH : 0)} de desgaste
          {invertido > f.precio ? ` (incluye ${dinero(invertido - f.precio)} en mejoras)` : ""}.
        </p>

        <h3>Consumo promedio imprimiendo</h3>
        <div className="tres">
          {MATERIALES.map((m) => (
            <Numero etiqueta={m} key={m} onCambio={(w) => cambiar({ watts: { ...f.watts, [m]: w } })} sufijo="W" valor={f.watts[m]} />
          ))}
        </div>
        <p className="suave">Si tienes un medidor de consumo eléctrico, registra el valor real. Con la cama a mayor temperatura, el consumo aumenta.</p>

        <h3>Refacciones de desgaste</h3>
        <p className="suave">Su costo se reparte por horas o por kilos impresos en esta impresora.</p>
        {f.refacciones.map((p) => (
          <div className="pieza" key={p.id}>
            <div className="pieza-cabeza">
              <Texto etiqueta="Pieza" onCambio={(nombre) => cambiarPieza(p.id, { nombre })} valor={p.nombre} />
              <button
                aria-label={`Quitar ${p.nombre}`}
                className="icono-boton"
                onClick={() => cambiar({ refacciones: f.refacciones.filter((x) => x.id !== p.id) })}
                type="button"
              >
                <Icono nombre="borrar" />
              </button>
            </div>
            <div className="tres">
              <Numero etiqueta="Costo" onCambio={(costo) => cambiarPieza(p.id, { costo })} sufijo="$" valor={p.costo} />
              <Numero etiqueta="Dura" onCambio={(vida) => cambiarPieza(p.id, { vida })} sufijo={p.unidad} valor={p.vida} />
              <div className="campo">
                <span>Medida</span>
                <Opciones onCambio={(unidad) => cambiarPieza(p.id, { unidad })} opciones={{ h: "horas", kg: "kg" }} valor={p.unidad} />
              </div>
            </div>
          </div>
        ))}
        <button
          className="boton secundario"
          onClick={() => cambiar({ refacciones: [...f.refacciones, { id: nuevoId(), nombre: "Nueva pieza", costo: 0, vida: 1000, unidad: "h" }] })}
          type="button"
        >
          <Icono nombre="mas" /> Agregar pieza
        </button>

        {f.id ? (
          <label className="casilla">
            <input checked={!!f.retirada} onChange={(e) => cambiar({ retirada: e.target.checked })} type="checkbox" />
            Retirada (la vendiste o ya no sirve): se guarda su historial pero ya no aparece para elegir
          </label>
        ) : null}
      </div>
    </Panel>
  );
}
