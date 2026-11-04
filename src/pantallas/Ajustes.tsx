import { useEffect, useState } from "react";

import { Bloque, Encabezado, Numero, Opciones, Texto } from "../componentes/basicos";
import { Icono } from "../componentes/iconos";
import { tasaFallas, totalImpresora } from "../lib/calculos";
import { buscarInicial, exportar, guardar, importar, MATERIALES, nuevoId, type Ajustes as TAjustes, type Datos, type Refaccion } from "../lib/datos";
import { dinero, fecha } from "../lib/formato";

export function Ajustes({ datos }: { datos: Datos }) {
  const a = datos.ajustes;
  const cambiar = (c: Partial<TAjustes>) => guardar((d) => ({ ...d, ajustes: { ...d.ajustes, ...c } }));
  const cambiarPieza = (id: string, c: Partial<Refaccion>) =>
    guardar((d) => ({ ...d, refacciones: d.refacciones.map((p) => (p.id === id ? { ...p, ...c } : p)) }));
  const impresora = totalImpresora(datos);

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
        <h3>Consumo promedio imprimiendo</h3>
        <div className="tres">
          {MATERIALES.map((m) => (
            <Numero
              etiqueta={m}
              key={m}
              onCambio={(w) => cambiar({ watts: { ...a.watts, [m]: w } })}
              sufijo="W"
              valor={a.watts[m]}
            />
          ))}
        </div>
        <p className="suave">
          Cuando tengas un medidor de enchufe puedes poner el consumo real. El PETG gasta más porque la cama va más caliente.
        </p>
      </Bloque>

      <div className="columna ancho-6">
      <Bloque clase="formulario" num="02" titulo="Impresora">
        <p className="suave">
          Invertido en la impresora y mejoras: <b className="tinta">{dinero(impresora)}</b> (se registra en Inventario → Otros
          gastos).
        </p>
        <Numero
          etiqueta="Vida útil estimada"
          onCambio={(vidaImpresoraH) => cambiar({ vidaImpresoraH })}
          sufijo="h"
          valor={a.vidaImpresoraH}
        />
        <p className="suave">
          Cada hora impresa cuesta {dinero(a.vidaImpresoraH ? impresora / a.vidaImpresoraH : 0)} de desgaste.
        </p>
      </Bloque>

      <Bloque clase="formulario" num="03" titulo="Ventas">
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
      </div>

      <Bloque clase="ancho-6 formulario" num="04" titulo="Refacciones que se gastan">
        <p className="suave">Su costo se reparte por horas o por kilos impresos. Son valores estimados: ajústalos con lo que pagues.</p>
        {datos.refacciones.map((p) => (
          <div className="pieza" key={p.id}>
            <div className="pieza-cabeza">
              <Texto etiqueta="Pieza" onCambio={(nombre) => cambiarPieza(p.id, { nombre })} valor={p.nombre} />
              <button
                aria-label={`Quitar ${p.nombre}`}
                className="icono-boton"
                onClick={() => guardar((d) => ({ ...d, refacciones: d.refacciones.filter((x) => x.id !== p.id) }))}
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
          onClick={() =>
            guardar((d) => ({ ...d, refacciones: [...d.refacciones, { id: nuevoId(), nombre: "Nueva pieza", costo: 0, vida: 1000, unidad: "h" }] }))
          }
          type="button"
        >
          <Icono nombre="mas" /> Agregar pieza
        </button>
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
    const hay = datos.rollos.length + datos.impresiones.length + datos.gastos.length;
    if (hay && !confirm(`Esto reemplaza todo lo que tienes ahora (${hay} registros) por ${origen}. ¿Seguir?`)) return;
    try {
      importar(texto);
      setAviso("Datos cargados.");
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  return (
    <Bloque clase="ancho-6 formulario" num="05" titulo="Respaldo">
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
