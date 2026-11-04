import { useEffect, useState } from "react";

import { Icono } from "./componentes/iconos";
import { pedirPersistencia, useDatos } from "./lib/datos";
import { Ajustes } from "./pantallas/Ajustes";
import { Impresiones } from "./pantallas/Impresiones";
import { Inventario } from "./pantallas/Inventario";
import { Resumen } from "./pantallas/Resumen";

type Pantalla = "resumen" | "impresiones" | "inventario" | "ajustes";

const PESTANAS: { id: Pantalla; texto: string }[] = [
  { id: "resumen", texto: "Resumen" },
  { id: "impresiones", texto: "Impresiones" },
  { id: "inventario", texto: "Inventario" },
  { id: "ajustes", texto: "Ajustes" },
];

export function App() {
  const datos = useDatos();
  const [pantalla, setPantalla] = useState<Pantalla>("resumen");

  useEffect(() => {
    void pedirPersistencia();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pantalla]);

  return (
    <>
      <main className="pagina">
        {pantalla === "resumen" ? <Resumen datos={datos} onIr={setPantalla} /> : null}
        {pantalla === "impresiones" ? <Impresiones datos={datos} /> : null}
        {pantalla === "inventario" ? <Inventario datos={datos} /> : null}
        {pantalla === "ajustes" ? <Ajustes datos={datos} /> : null}
      </main>
      <nav className="pestanas">
        {PESTANAS.map((p) => (
          <button aria-current={pantalla === p.id ? "page" : undefined} key={p.id} onClick={() => setPantalla(p.id)} type="button">
            <Icono nombre={p.id} tamano={22} />
            <span>{p.texto}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
