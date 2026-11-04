import { useEffect, useState } from "react";

import { Icono } from "./componentes/iconos";
import { useBandeja } from "./lib/bandeja";
import { buscarInicial, importar, pedirPersistencia, useDatos } from "./lib/datos";
import { dinero, fecha } from "./lib/formato";
import { Ajustes } from "./pantallas/Ajustes";
import { Impresiones } from "./pantallas/Impresiones";
import { Inventario } from "./pantallas/Inventario";
import { Resumen } from "./pantallas/Resumen";

export type Pantalla = "resumen" | "impresiones" | "inventario" | "ajustes";

const PESTANAS: { id: Pantalla; texto: string }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "impresiones", texto: "Impresiones" },
  { id: "inventario", texto: "Inventario" },
  { id: "ajustes", texto: "Ajustes" },
];

export function App() {
  const datos = useDatos();
  const bandeja = useBandeja();
  // La pantalla actual va en la dirección (#inventario), así se puede guardar como marcador.
  const [pantalla, setPantalla] = useState<Pantalla>(() => {
    const h = location.hash.slice(1);
    return PESTANAS.some((p) => p.id === h) ? (h as Pantalla) : "resumen";
  });

  useEffect(() => {
    void pedirPersistencia();
    // Primera vez y vacía: si la PC ofrece el pedido inicial, se carga solo.
    if (!datos.rollos.length && !datos.gastos.length && !datos.impresiones.length) {
      void buscarInicial().then((texto) => texto && importar(texto));
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    history.replaceState(null, "", `#${pantalla}`);
  }, [pantalla]);

  // En la PC el menú va a la izquierda; en el celular baja a una barra inferior.
  return (
    <div className="marco">
      <nav className="menu">
        <div className="marca">
          <Icono nombre="inventario" tamano={22} />
          <span>
            COSTOS<b>3D</b>
          </span>
        </div>
        <div className="menu-botones">
          {PESTANAS.map((p) => (
            <button aria-current={pantalla === p.id ? "page" : undefined} key={p.id} onClick={() => setPantalla(p.id)} type="button">
              <Icono nombre={p.id} tamano={20} />
              <span>{p.texto}</span>
              {p.id === "impresiones" && bandeja.length ? <em className="globo">{bandeja.length}</em> : null}
            </button>
          ))}
        </div>
        <dl className="menu-datos">
          <div>
            <dt>kWh</dt>
            <dd>{dinero(datos.ajustes.kwh)}</dd>
          </div>
          <div>
            <dt>Respaldo</dt>
            <dd>{datos.ultimoRespaldo ? fecha(datos.ultimoRespaldo.slice(0, 10)) : "nunca"}</dd>
          </div>
        </dl>
      </nav>
      <main className="pagina">
        {pantalla === "resumen" ? <Resumen datos={datos} onIr={setPantalla} /> : null}
        {pantalla === "impresiones" ? <Impresiones datos={datos} /> : null}
        {pantalla === "inventario" ? <Inventario datos={datos} /> : null}
        {pantalla === "ajustes" ? <Ajustes datos={datos} /> : null}
      </main>
    </div>
  );
}
