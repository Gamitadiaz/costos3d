import { useState } from "react";

import { Barra, Encabezado, Numero, Opciones, Texto } from "../componentes/basicos";
import { Icono } from "../componentes/iconos";
import { precioGramo, restanteRollo, usadoRollo } from "../lib/calculos";
import { CATEGORIAS, guardar, hoy, MATERIALES, nuevoId, type Datos, type Gasto, type Material, type Rollo } from "../lib/datos";
import { dinero, fecha, gramos } from "../lib/formato";

type Vista = "rollos" | "gastos";

export function Inventario({ datos }: { datos: Datos }) {
  const [vista, setVista] = useState<Vista>("rollos");
  const [rollo, setRollo] = useState<(Rollo & { cantidad: number }) | null>(null);
  const [gasto, setGasto] = useState<Gasto | null>(null);

  if (rollo) return <FormRollo datos={datos} inicial={rollo} onCerrar={() => setRollo(null)} />;
  if (gasto) return <FormGasto inicial={gasto} onCerrar={() => setGasto(null)} />;

  return (
    <>
      <Encabezado sub="Tus rollos y todo lo que has comprado" titulo="Inventario" />
      <Opciones onCambio={setVista} opciones={{ rollos: "Filamento", gastos: "Otros gastos" }} valor={vista} />
      {vista === "rollos" ? <Rollos datos={datos} onEditar={setRollo} /> : <Gastos datos={datos} onEditar={setGasto} />}
    </>
  );
}

function Rollos({ datos, onEditar }: { datos: Datos; onEditar: (r: Rollo & { cantidad: number }) => void }) {
  const orden = [...datos.rollos].sort((a, b) => Number(!!a.agotado) - Number(!!b.agotado) || a.material.localeCompare(b.material));

  return (
    <>
      <button
        className="boton"
        onClick={() =>
          onEditar({ id: "", marca: "", nombre: "", material: "PLA", color: "", hex: "#cccccc", pesoG: 1000, precio: 0, fecha: hoy(), ajusteG: 0, cantidad: 1 })
        }
        type="button"
      >
        <Icono nombre="mas" /> Agregar rollo
      </button>
      {!orden.length ? <p className="vacio">Sin rollos todavía.</p> : null}
      <ul className="rollos">
        {orden.map((r) => {
          const queda = restanteRollo(datos, r);
          return (
            <li className={`rollo ${r.agotado ? "agotado" : ""}`} key={r.id}>
              <button className="rollo-cabeza" onClick={() => onEditar({ ...r, cantidad: 1 })} type="button">
                <i className="carrete" style={{ "--color": r.hex } as React.CSSProperties} />
                <div>
                  <b>
                    {r.material} {r.color}
                  </b>
                  <small>
                    {r.marca}
                    {r.nombre ? ` · ${r.nombre}` : ""} · {dinero(precioGramo(r) * 1000)}/kg
                  </small>
                </div>
                <span className="rollo-queda">{r.agotado ? "Agotado" : gramos(queda)}</span>
              </button>
              {!r.agotado ? <Barra tono={queda / r.pesoG < 0.15 ? "aviso" : undefined} valor={queda / r.pesoG} /> : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function FormRollo({ datos, inicial, onCerrar }: { datos: Datos; inicial: Rollo & { cantidad: number }; onCerrar: () => void }) {
  const [f, setF] = useState(inicial);
  const cambiar = (c: Partial<typeof f>) => setF((x) => ({ ...x, ...c }));
  const usado = f.id ? usadoRollo(datos, f.id) : 0;
  const [pesado, setPesado] = useState(f.id ? restanteRollo(datos, f) : f.pesoG);
  const marcas = [...new Set(datos.rollos.map((r) => r.marca).filter(Boolean))];

  function guardarRollo() {
    const { cantidad, ...rollo } = f;
    if (f.id) {
      // Si escribiste cuánto queda, se guarda la diferencia con lo calculado.
      const ajusteG = Math.round(pesado - (f.pesoG - usado));
      guardar((d) => ({ ...d, rollos: d.rollos.map((x) => (x.id === f.id ? { ...rollo, ajusteG } : x)) }));
    } else {
      const nuevos = Array.from({ length: Math.max(1, cantidad) }, () => ({ ...rollo, id: nuevoId(), ajusteG: 0 }));
      guardar((d) => ({ ...d, rollos: [...d.rollos, ...nuevos] }));
    }
    onCerrar();
  }

  return (
    <>
      <header className="encabezado con-cerrar">
        <h1>{f.id ? "Editar rollo" : "Nuevo rollo"}</h1>
        <button aria-label="Cerrar" className="icono-boton" onClick={onCerrar} type="button">
          <Icono nombre="cerrar" />
        </button>
      </header>

      <section className="formulario">
        <div className="campo">
          <span>Material</span>
          <Opciones
            onCambio={(material) => cambiar({ material })}
            opciones={Object.fromEntries(MATERIALES.map((m) => [m, m])) as Record<Material, string>}
            valor={f.material}
          />
        </div>
        <datalist id="marcas">
          {marcas.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <div className="dos">
          <Texto etiqueta="Marca" lista="marcas" onCambio={(marca) => cambiar({ marca })} valor={f.marca} />
          <Texto etiqueta="Línea (opcional)" onCambio={(nombre) => cambiar({ nombre })} valor={f.nombre} />
        </div>
        <div className="dos color">
          <Texto etiqueta="Color" onCambio={(color) => cambiar({ color })} valor={f.color} />
          <label className="campo">
            <span>Tono</span>
            <input className="selector-color" onChange={(e) => cambiar({ hex: e.target.value })} type="color" value={f.hex} />
          </label>
        </div>
        <div className="dos">
          <Numero etiqueta="Precio por rollo" onCambio={(precio) => cambiar({ precio })} sufijo="$" valor={f.precio} />
          <Numero etiqueta="Peso del filamento" onCambio={(pesoG) => cambiar({ pesoG })} sufijo="g" valor={f.pesoG} />
        </div>
        <Texto etiqueta="Fecha de compra" onCambio={(v) => cambiar({ fecha: v })} tipo="date" valor={f.fecha} />
        {!f.id ? (
          <Numero
            etiqueta="¿Cuántos rollos iguales? (un 2-pack son 2)"
            onCambio={(cantidad) => cambiar({ cantidad: Math.round(cantidad) })}
            paso="1"
            valor={f.cantidad}
          />
        ) : (
          <>
            <Numero etiqueta="Le quedan (si lo pesas, sin el carrete)" onCambio={setPesado} sufijo="g" valor={pesado} />
            <p className="suave">Según tus impresiones lleva {gramos(usado)} usados.</p>
          </>
        )}
      </section>

      <button className="boton" disabled={!f.marca || !f.color || f.precio <= 0} onClick={guardarRollo} type="button">
        Guardar
      </button>
      {f.id ? (
        <div className="fila-botones">
          <button className="boton secundario" onClick={() => (cambiar({ agotado: !f.agotado }))} type="button">
            {f.agotado ? "Marcar como disponible" : "Marcar como agotado"}
          </button>
          <button
            className="boton peligro"
            disabled={usado > 0}
            onClick={() => {
              if (confirm("¿Borrar este rollo?")) {
                guardar((d) => ({ ...d, rollos: d.rollos.filter((x) => x.id !== f.id) }));
                onCerrar();
              }
            }}
            title={usado > 0 ? "Tiene impresiones; mejor márcalo como agotado" : undefined}
            type="button"
          >
            <Icono nombre="borrar" /> Borrar
          </button>
        </div>
      ) : null}
    </>
  );
}

function Gastos({ datos, onEditar }: { datos: Datos; onEditar: (g: Gasto) => void }) {
  const lista = [...datos.gastos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <>
      <button
        className="boton"
        onClick={() => onEditar({ id: "", fecha: hoy(), concepto: "", monto: 0, categoria: "refaccion" })}
        type="button"
      >
        <Icono nombre="mas" /> Agregar gasto
      </button>
      <p className="suave">
        La impresora y sus mejoras se reparten como <b className="tinta">desgaste</b> entre tus impresiones. Las demás compras
        cuentan en el dinero gastado.
      </p>
      <ul className="lista">
        {lista.map((g) => (
          <li className="item" key={g.id}>
            <button className="item-cabeza" onClick={() => onEditar(g)} type="button">
              <div>
                <b>{g.concepto}</b>
                <small>
                  {CATEGORIAS[g.categoria]} · {fecha(g.fecha)}
                </small>
              </div>
              <div className="item-cifra">
                <b>{dinero(g.monto)}</b>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function FormGasto({ inicial, onCerrar }: { inicial: Gasto; onCerrar: () => void }) {
  const [f, setF] = useState(inicial);
  const cambiar = (c: Partial<Gasto>) => setF((x) => ({ ...x, ...c }));

  return (
    <>
      <header className="encabezado con-cerrar">
        <h1>{f.id ? "Editar gasto" : "Nuevo gasto"}</h1>
        <button aria-label="Cerrar" className="icono-boton" onClick={onCerrar} type="button">
          <Icono nombre="cerrar" />
        </button>
      </header>
      <section className="formulario">
        <Texto etiqueta="¿Qué compraste?" onCambio={(concepto) => cambiar({ concepto })} valor={f.concepto} />
        <div className="dos">
          <Numero etiqueta="Monto" onCambio={(monto) => cambiar({ monto })} sufijo="$" valor={f.monto} />
          <Texto etiqueta="Fecha" onCambio={(v) => cambiar({ fecha: v })} tipo="date" valor={f.fecha} />
        </div>
        <div className="campo">
          <span>Categoría</span>
          <Opciones onCambio={(categoria) => cambiar({ categoria })} opciones={CATEGORIAS} valor={f.categoria} />
        </div>
      </section>
      <button
        className="boton"
        disabled={!f.concepto.trim() || f.monto <= 0}
        onClick={() => {
          guardar((d) => ({
            ...d,
            gastos: f.id ? d.gastos.map((x) => (x.id === f.id ? f : x)) : [...d.gastos, { ...f, id: nuevoId() }],
          }));
          onCerrar();
        }}
        type="button"
      >
        Guardar
      </button>
      {f.id ? (
        <button
          className="boton peligro"
          onClick={() => {
            if (confirm(`¿Borrar "${f.concepto}"?`)) {
              guardar((d) => ({ ...d, gastos: d.gastos.filter((x) => x.id !== f.id) }));
              onCerrar();
            }
          }}
          type="button"
        >
          <Icono nombre="borrar" /> Borrar
        </button>
      ) : null}
    </>
  );
}
