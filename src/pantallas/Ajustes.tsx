import { useEffect, useState } from "react";

import { Bloque, Encabezado, Numero } from "../componentes/basicos";
import { tasaFallas } from "../lib/calculos";
import { buscarInicial, exportar, guardar, importar, type Ajustes as TAjustes, type Datos } from "../lib/datos";
import { fecha } from "../lib/formato";

export function Ajustes({ datos }: { datos: Datos }) {
  const a = datos.ajustes;
  const cambiar = (c: Partial<TAjustes>) => guardar((d) => ({ ...d, ajustes: { ...d.ajustes, ...c } }));

  return (
    <>
      <Encabezado sub="Los números con los que se calcula todo" titulo="Ajustes" />

      <div className="rejilla">
      <Bloque clase="ancho-6 formulario" num="01" titulo="Luz">
        <Numero etiqueta="Precio del kWh" onCambio={(kwh) => cambiar({ kwh })} sufijo="$" valor={a.kwh} />
        <p className="suave">
          Es un estimado. En tu recibo de CFE divide el <b className="tinta">total a pagar</b> entre los{" "}
          <b className="tinta">kWh consumidos</b> y pon aquí el resultado.
        </p>
        <p className="suave">El consumo en watts, la vida útil y las refacciones se ajustan en cada impresora (menú Impresoras).</p>
      </Bloque>

      <Bloque clase="ancho-6 formulario" num="02" titulo="Ventas">
        <div className="dos">
          <Numero etiqueta="Tu hora de trabajo vale" onCambio={(valorHora) => cambiar({ valorHora })} sufijo="$/h" valor={a.valorHora} />
          <Numero
            etiqueta="Tiempo típico por pieza"
            onCambio={(trabajoTipico) => cambiar({ trabajoTipico: Math.round(trabajoTipico) })}
            sufijo="min"
            valor={a.trabajoTipico}
          />
        </div>
        <Numero etiqueta="Margen de ganancia" onCambio={(margen) => cambiar({ margen })} sufijo="%" valor={a.margen} />
        <p className="suave">
          Precio sugerido = (costo real + tu tiempo) + tasa de fallas ({Math.round(tasaFallas(datos) * 100)} % ahora, se calcula
          sola con tus impresiones fallidas) + margen. Como tu tiempo ya va incluido, un margen de 30–50 % suele bastar.
        </p>
      </Bloque>

      <Respaldo datos={datos} />
      </div>
    </>
  );
}

function Respaldo({ datos }: { datos: Datos }) {
  const [inicial, setInicial] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    void buscarInicial().then(setInicial);
  }, []);

  function cargarTexto(texto: string, origen: string) {
    const hay = datos.impresoras.length + datos.rollos.length + datos.impresiones.length + datos.gastos.length;
    if (hay && !confirm(`Esto reemplaza todo lo que tienes ahora (${hay} registros) por ${origen}. ¿Seguir?`)) return;
    try {
      importar(texto);
      setAviso("Datos cargados.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  return (
    <Bloque clase="ancho-6 formulario" num="03" titulo="Respaldo">
      <p className="suave">
        Tus datos viven solo en este navegador. Descarga un respaldo de vez en cuando.
        {datos.ultimoRespaldo ? ` Último: ${fecha(datos.ultimoRespaldo.slice(0, 10))}.` : " Aún no has hecho ninguno."}
      </p>
      <button className="boton" onClick={exportar} type="button">
        Descargar respaldo
      </button>
      <label className="boton secundario">
        Cargar un respaldo
        <input
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const archivo = e.target.files?.[0];
            if (archivo) cargarTexto(await archivo.text(), "el respaldo");
            e.target.value = "";
          }}
          type="file"
        />
      </label>
      {inicial ? (
        <button className="boton secundario" onClick={() => cargarTexto(inicial, "tu pedido inicial")} type="button">
          Cargar mi pedido inicial (impresora + filamento)
        </button>
      ) : null}
      {aviso ? <p className="aviso">{aviso}</p> : null}
    </Bloque>
  );
}
