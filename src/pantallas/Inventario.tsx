import { useState } from "react";

import { Carrete, Encabezado, Numero, Opciones, Panel, Texto } from "../componentes/basicos";
import { Icono } from "../componentes/iconos";
import { impresoraDe, impresoraReciente, precioGramo, restanteRollo, usadoRollo } from "../lib/calculos";
import { CATEGORIAS, guardar, hoy, MATERIALES, nuevoId, type Datos, type Gasto, type Material, type Rollo } from "../lib/datos";
import { dinero, fecha, gramos } from "../lib/formato";

type Vista = "rollos" | "gastos";

// Categorías de gasto que pertenecen a una impresora en particular.
const DE_IMPRESORA: Gasto["categoria"][] = ["impresora", "reparacion", "refaccion"];
type RolloForm = Rollo & { cantidad: number };

const ROLLO_NUEVO: RolloForm = {
  id: "",
  marca: "",
  nombre: "",
  material: "PLA",
  color: "",
  hex: "#cccccc",
  pesoG: 1000,
  precio: 0,
  fecha: "",
  ajusteG: 0,
  cantidad: 1,
};

export function Inventario({ datos }: { datos: Datos }) {
  const [vista, setVista] = useState<Vista>("rollos");
  const [rollo, setRollo] = useState<RolloForm | null>(null);
  const [gasto, setGasto] = useState<Gasto | null>(null);
  const [verAgotados, setVerAgotados] = useState(false);

  const nuevoGasto = (categoria: Gasto["categoria"]) =>
    setGasto({ id: "", fecha: hoy(), concepto: "", monto: 0, categoria, impresoraId: impresoraReciente(datos)?.id });

  return (
    <>
      <Encabezado
        accion={
          vista === "rollos" ? (
            <button className="boton" onClick={() => setRollo({ ...ROLLO_NUEVO, fecha: hoy() })} type="button">
              <Icono nombre="mas" /> Agregar rollo
            </button>
          ) : (
            <div className="fila-botones">
              <button className="boton secundario" onClick={() => nuevoGasto("reparacion")} type="button">
                <Icono nombre="llave" /> Registrar avería
              </button>
              <button className="boton" onClick={() => nuevoGasto("refaccion")} type="button">
                <Icono nombre="mas" /> Agregar gasto
              </button>
            </div>
          )
        }
        sub="Tus rollos, compras y reparaciones"
        titulo="Inventario"
      />
      <Opciones onCambio={setVista} opciones={{ rollos: "Filamento", gastos: "Gastos y reparaciones" }} valor={vista} />

      {vista === "rollos" ? (
        <Rollos datos={datos} onEditar={setRollo} setVerAgotados={setVerAgotados} verAgotados={verAgotados} />
      ) : (
        <Gastos datos={datos} onEditar={setGasto} />
      )}

      {rollo ? <FormRollo datos={datos} inicial={rollo} onCerrar={() => setRollo(null)} /> : null}
      {gasto ? <FormGasto datos={datos} inicial={gasto} onCerrar={() => setGasto(null)} /> : null}
    </>
  );
}

function Rollos({
  datos,
  onEditar,
  verAgotados,
  setVerAgotados,
}: {
  datos: Datos;
  onEditar: (r: RolloForm) => void;
  verAgotados: boolean;
  setVerAgotados: (v: boolean) => void;
}) {
  const agotados = datos.rollos.filter((r) => r.agotado).length;
  const grupos = MATERIALES.map((m) => ({
    m,
    rollos: datos.rollos.filter((r) => r.material === m && (verAgotados || !r.agotado)).sort((a, b) => a.color.localeCompare(b.color)),
  })).filter((g) => g.rollos.length);

  if (!datos.rollos.length) return <p className="vacio">Sin rollos todavía.</p>;

  return (
    <>
      {grupos.map(({ m, rollos }) => {
        const total = rollos.filter((r) => !r.agotado).reduce((s, r) => s + restanteRollo(datos, r), 0);
        return (
          <section className="grupo" key={m}>
            <h2 className="grupo-titulo">
              {m} <span>{rollos.length} rollos · {gramos(total)}</span>
            </h2>
            <ul className="rollos">
              {rollos.map((r) => {
                const queda = restanteRollo(datos, r);
                return (
                  <li key={r.id}>
                    <button className={`rollo ${r.agotado ? "agotado" : ""}`} onClick={() => onEditar({ ...r, cantidad: 1 })} type="button">
                      <Carrete hex={r.hex} valor={r.agotado ? 0 : queda / r.pesoG} />
                      <b>{r.color}</b>
                      <small>{r.nombre || r.marca}</small>
                      <span className="rollo-queda">{r.agotado ? "Agotado" : gramos(queda)}</span>
                      <small className="tenue">{dinero(precioGramo(r) * 1000)}/kg</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {agotados ? (
        <button className="enlace" onClick={() => setVerAgotados(!verAgotados)} type="button">
          {verAgotados ? "Ocultar agotados" : `Ver ${agotados} rollo(s) agotado(s)`}
        </button>
      ) : null}
    </>
  );
}

function FormRollo({ datos, inicial, onCerrar }: { datos: Datos; inicial: RolloForm; onCerrar: () => void }) {
  const [f, setF] = useState(inicial);
  const cambiar = (c: Partial<RolloForm>) => setF((x) => ({ ...x, ...c }));
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
    <Panel
      onCerrar={onCerrar}
      pie={
        <>
          {f.id ? (
            <button
              aria-label="Borrar rollo"
              className="icono-boton peligro"
              disabled={usado > 0}
              onClick={() => {
                if (confirm("¿Borrar este rollo?")) {
                  guardar((d) => ({ ...d, rollos: d.rollos.filter((x) => x.id !== f.id) }));
                  onCerrar();
                }
              }}
              title={usado > 0 ? "Tiene impresiones; mejor márcalo como agotado" : "Borrar"}
              type="button"
            >
              <Icono nombre="borrar" />
            </button>
          ) : null}
          <button className="boton" disabled={!f.marca || !f.color || f.precio <= 0} onClick={guardarRollo} type="button">
            Guardar
          </button>
        </>
      }
      titulo={f.id ? "Editar rollo" : "Nuevo rollo"}
    >
      <div className="rollo-vista">
        <Carrete hex={f.hex} tamano={96} valor={f.id ? pesado / f.pesoG : 1} />
        <div>
          <b>
            {f.material} {f.color || "—"}
          </b>
          <small>{f.marca || "Marca"}</small>
        </div>
      </div>

      <div className="formulario">
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
        <div className="tres">
          <Numero etiqueta="Precio por rollo" onCambio={(precio) => cambiar({ precio })} sufijo="$" valor={f.precio} />
          <Numero etiqueta="Peso" onCambio={(pesoG) => cambiar({ pesoG })} sufijo="g" valor={f.pesoG} />
          <Texto etiqueta="Compra" onCambio={(v) => cambiar({ fecha: v })} tipo="date" valor={f.fecha} />
        </div>
        {!f.id ? (
          <Numero
            etiqueta="¿Cuántos rollos iguales? (un 2-pack son 2)"
            onCambio={(cantidad) => cambiar({ cantidad: Math.round(cantidad) })}
            valor={f.cantidad}
          />
        ) : (
          <>
            <Numero etiqueta="Le quedan (si lo pesas, sin el carrete)" onCambio={setPesado} sufijo="g" valor={pesado} />
            <p className="suave">Según tus impresiones lleva {gramos(usado)} usados.</p>
            <label className="casilla">
              <input checked={!!f.agotado} onChange={(e) => cambiar({ agotado: e.target.checked })} type="checkbox" />
              Rollo agotado (se oculta y deja de contar)
            </label>
          </>
        )}
      </div>
    </Panel>
  );
}

function Gastos({ datos, onEditar }: { datos: Datos; onEditar: (g: Gasto) => void }) {
  const lista = [...datos.gastos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const varias = datos.impresoras.length > 1;
  if (!lista.length) return <p className="vacio">Sin gastos registrados.</p>;

  return (
    <>
      <p className="suave">
        Las mejoras se suman al precio de su impresora y se reparten como <b className="tinta">desgaste</b>. Refacciones y
        reparaciones se comparan con lo que tus impresiones apartan (ver Resumen). El precio de cada impresora está en
        Impresoras.
      </p>
      <div className="tabla-marco">
        <table className="tabla">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Categoría</th>
              {varias ? <th>Impresora</th> : null}
              <th>Fecha</th>
              <th className="num">Monto</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((g) => (
              <tr key={g.id} onClick={() => onEditar(g)} onKeyDown={(e) => e.key === "Enter" && onEditar(g)} tabIndex={0}>
                <td>
                  <span className="pieza-nombre">
                    {g.categoria === "reparacion" ? <Icono nombre="llave" tamano={16} /> : null}
                    <span>
                      {g.concepto}
                      {g.nota ? <small className="tenue bloque-linea">{g.nota}</small> : null}
                    </span>
                  </span>
                </td>
                <td>
                  <span className={`chip ${g.categoria}`}>{CATEGORIAS[g.categoria]}</span>
                </td>
                {varias ? <td className="tenue">{g.impresoraId ? impresoraDe(datos, g.impresoraId)?.nombre : "—"}</td> : null}
                <td className="tenue">{fecha(g.fecha)}</td>
                <td className="num fuerte">{dinero(g.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FormGasto({ datos, inicial, onCerrar }: { datos: Datos; inicial: Gasto; onCerrar: () => void }) {
  const [f, setF] = useState(inicial);
  const cambiar = (c: Partial<Gasto>) => setF((x) => ({ ...x, ...c }));
  const averia = f.categoria === "reparacion";
  const deImpresora = DE_IMPRESORA.includes(f.categoria);
  const maquinas = datos.impresoras.filter((x) => !x.retirada || x.id === f.impresoraId);

  return (
    <Panel
      onCerrar={onCerrar}
      pie={
        <>
          {f.id ? (
            <button
              aria-label="Borrar gasto"
              className="icono-boton peligro"
              onClick={() => {
                if (confirm(`¿Borrar "${f.concepto}"?`)) {
                  guardar((d) => ({ ...d, gastos: d.gastos.filter((x) => x.id !== f.id) }));
                  onCerrar();
                }
              }}
              type="button"
            >
              <Icono nombre="borrar" />
            </button>
          ) : null}
          <button
            className="boton"
            disabled={!f.concepto.trim() || f.monto < 0}
            onClick={() => {
              const listo = { ...f, impresoraId: deImpresora ? (f.impresoraId ?? maquinas[0]?.id) : undefined };
              guardar((d) => ({
                ...d,
                gastos: f.id ? d.gastos.map((x) => (x.id === f.id ? listo : x)) : [...d.gastos, { ...listo, id: nuevoId() }],
              }));
              onCerrar();
            }}
            type="button"
          >
            Guardar
          </button>
        </>
      }
      titulo={f.id ? "Editar" : averia ? "Registrar avería" : "Nuevo gasto"}
    >
      <div className="formulario">
        <div className="campo">
          <span>Categoría</span>
          <Opciones onCambio={(categoria) => cambiar({ categoria })} opciones={CATEGORIAS} valor={f.categoria} />
        </div>
        {deImpresora && maquinas.length > 1 ? (
          <div className="campo">
            <span>¿De qué impresora?</span>
            <Opciones
              onCambio={(impresoraId) => cambiar({ impresoraId })}
              opciones={Object.fromEntries(maquinas.map((x) => [x.id, x.nombre]))}
              valor={f.impresoraId ?? ""}
            />
          </div>
        ) : null}
        <Texto
          etiqueta={averia ? "¿Qué se rompió?" : "¿Qué compraste?"}
          onCambio={(concepto) => cambiar({ concepto })}
          valor={f.concepto}
        />
        <div className="dos">
          <Numero etiqueta={averia ? "Lo que costó arreglarlo" : "Monto"} onCambio={(monto) => cambiar({ monto })} sufijo="$" valor={f.monto} />
          <Texto etiqueta="Fecha" onCambio={(v) => cambiar({ fecha: v })} tipo="date" valor={f.fecha} />
        </div>
        <Texto
          etiqueta={averia ? "¿Qué pasó y cómo se arregló? (opcional)" : "Nota (opcional)"}
          onCambio={(nota) => cambiar({ nota })}
          valor={f.nota ?? ""}
        />
        {averia ? (
          <p className="suave">
            Si se arregló sin gastar (por ejemplo, destapar la boquilla), deja el monto en 0: sirve como historial de fallas.
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
