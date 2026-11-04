import type { Pantalla } from "../App";
import { Anillo, Barra, Bloque, Carrete, Encabezado } from "../componentes/basicos";
import { useBandeja } from "../lib/bandeja";
import { resumen, restanteRollo } from "../lib/calculos";
import type { Datos } from "../lib/datos";
import { dinero, gramos, numero } from "../lib/formato";

export function Resumen({ datos, onIr }: { datos: Datos; onIr: (p: Pantalla) => void }) {
  const r = resumen(datos);
  const bandeja = useBandeja();
  const activos = datos.rollos
    .filter((x) => !x.agotado)
    .map((x) => ({ x, queda: restanteRollo(datos, x) }))
    .sort((a, b) => a.queda / a.x.pesoG - b.queda / b.x.pesoG);
  const vacia = !datos.rollos.length && !datos.gastos.length;

  // Para la barra de "¿en qué se fue el dinero?".
  const partes = [
    { t: "Impresora", v: r.enImpresora },
    { t: "Filamento", v: r.enFilamento },
    { t: "Refacciones y otros", v: r.enOtros },
    { t: "Luz", v: r.luz },
  ];

  return (
    <>
      <Encabezado sub="Lo que de verdad te ha costado imprimir" titulo="Resumen" />

      {bandeja.length ? (
        <button className="aviso aviso-boton" onClick={() => onIr("impresiones")} type="button">
          OrcaSlicer mandó {bandeja.length} impresión(es) por confirmar → Registrar
        </button>
      ) : null}

      {vacia ? (
        <Bloque clase="ancho-12 bienvenida" titulo="Para empezar">
          <p className="suave">Registra la impresora como gasto y tus rollos de filamento.</p>
          <div className="fila-botones">
            <button className="boton" onClick={() => onIr("inventario")} type="button">
              Ir a Inventario
            </button>
          </div>
        </Bloque>
      ) : null}

      <div className="rejilla">
        <section className={`portada ancho-8 ${r.balance >= 0 ? "positivo" : ""}`}>
          <span className="rotulo">Balance general · ventas − todo lo gastado</span>
          <strong className="grande">{dinero(r.balance)}</strong>
          <div className="portada-datos">
            <div>
              <span>Gastado</span>
              <b>{dinero(r.gastado)}</b>
            </div>
            <div>
              <span>Vendido</span>
              <b>{dinero(r.ingresos)}</b>
            </div>
            <div>
              <span>Ganancia en ventas</span>
              <b className={r.ganancia >= 0 ? "bien" : "mal"}>{dinero(r.ganancia)}</b>
              {r.porHora !== null ? <small className="tenue">{dinero(r.porHora)} por hora de tu trabajo</small> : null}
            </div>
          </div>
        </section>

        <Bloque clase="ancho-4 centrado" num="01" titulo="Inversión recuperada">
          <Anillo valor={r.recuperado}>
            <strong>{numero(r.recuperado * 100)}%</strong>
            <small>de {dinero(r.gastado)}</small>
          </Anillo>
          <p className="suave centro">
            {r.ingresos > 0 ? "Solo cuentan las ventas." : "Sin ventas aún: lo tuyo es gasto, no ganancia."}
          </p>
        </Bloque>

        <Cifra etiqueta="Uso personal" nota={`${r.propias} piezas · gasto`} valor={dinero(r.costoPropio)} />
        <Cifra etiqueta="Impresiones fallidas" nota={`${r.fallas} intentos · tasa ${numero(r.tasaFallas * 100)} %`} tono={r.fallas ? "mal" : undefined} valor={dinero(r.costoFallas)} />
        <Cifra etiqueta="Luz consumida" nota={`a ${dinero(datos.ajustes.kwh)} el kWh`} valor={dinero(r.luz)} />
        <Cifra etiqueta="Tiempo imprimiendo" nota={`${gramos(r.gramos)} de filamento`} valor={`${numero(r.horas)} h`} />

        <Bloque clase="ancho-5" num="02" titulo="¿En qué se fue el dinero?">
          <div className="pila">
            {partes.map((p) => (
              <i key={p.t} style={{ flexGrow: p.v }} title={`${p.t}: ${dinero(p.v)}`} />
            ))}
          </div>
          <ul className="lista-simple">
            {partes.map((p) => (
              <li key={p.t}>
                <span>
                  <i className="punto" />
                  {p.t}
                </span>
                <b>{dinero(p.v)}</b>
              </li>
            ))}
          </ul>
        </Bloque>

        <Bloque
          accion={
            <button className="enlace" onClick={() => onIr("inventario")} type="button">
              Ver inventario →
            </button>
          }
          clase="ancho-7"
          num="03"
          titulo="Filamento"
        >
          <p className="suave">
            Quedan <b className="tinta">{gramos(r.filamentoRestanteG)}</b> en {activos.length} rollos · valen {dinero(r.filamentoValor)}
          </p>
          <div className="mini-rollos">
            {activos.map(({ x, queda }) => (
              <div key={x.id} title={`${x.material} ${x.color}: ${gramos(queda)}`}>
                <Carrete hex={x.hex} tamano={46} valor={queda / x.pesoG} />
                <small>{x.material}</small>
              </div>
            ))}
          </div>
        </Bloque>

        <Bloque clase="ancho-6" num="04" titulo="Mantenimiento y reparaciones">
          <div className="dos-cifras">
            <div>
              <span>Apartado en tus costos</span>
              <b>{dinero(r.apartado)}</b>
            </div>
            <div>
              <span>Gastado de verdad</span>
              <b className={r.enMantenimiento > r.apartado ? "mal" : ""}>{dinero(r.enMantenimiento)}</b>
            </div>
          </div>
          <p className="suave">
            {r.reparaciones
              ? `${r.reparaciones} reparación(es) registradas. `
              : "Sin reparaciones registradas. "}
            Cada impresión aparta un poco para refacciones; si gastas más de lo apartado, sube sus costos en Ajustes.
          </p>
        </Bloque>

        <Bloque clase="ancho-6" num="05" titulo="Desgaste de la impresora">
          <div className="dos-cifras">
            <div>
              <span>Horas de uso</span>
              <b>{numero(r.horas)} h</b>
            </div>
            <div>
              <span>Vida estimada</span>
              <b>{numero(datos.ajustes.vidaImpresoraH)} h</b>
            </div>
          </div>
          <Barra tono={r.vidaUsada > 0.8 ? "aviso" : undefined} valor={r.vidaUsada} />
        </Bloque>
      </div>
    </>
  );
}

function Cifra({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: string; nota?: string; tono?: "mal" }) {
  return (
    <div className={`cifra ancho-3 ${tono ?? ""}`}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
      {nota ? <small>{nota}</small> : null}
    </div>
  );
}
