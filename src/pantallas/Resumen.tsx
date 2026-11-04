import { Barra, Encabezado } from "../componentes/basicos";
import { resumen, restanteRollo } from "../lib/calculos";
import type { Datos } from "../lib/datos";
import { dinero, gramos, numero } from "../lib/formato";

export function Resumen({ datos, onIr }: { datos: Datos; onIr: (p: "inventario" | "ajustes") => void }) {
  const r = resumen(datos);
  const porAcabar = datos.rollos
    .filter((x) => !x.agotado)
    .map((x) => ({ x, queda: restanteRollo(datos, x) }))
    .filter(({ x, queda }) => queda / x.pesoG < 0.15);

  return (
    <>
      <Encabezado sub="Lo que de verdad te ha costado imprimir" titulo="Resumen" />

      {!datos.rollos.length && !datos.gastos.length ? (
        <section className="tarjeta bienvenida">
          <h2>Para empezar</h2>
          <p className="suave">
            Registra la impresora como gasto y tus rollos de filamento. Si abres la app desde tu PC, en Ajustes hay un botón
            que carga tu pedido de una vez.
          </p>
          <div className="fila-botones">
            <button className="boton" onClick={() => onIr("ajustes")} type="button">
              Ir a Ajustes
            </button>
            <button className="boton secundario" onClick={() => onIr("inventario")} type="button">
              Agregar a mano
            </button>
          </div>
        </section>
      ) : null}

      <section className={`portada ${r.balance >= 0 ? "positivo" : ""}`}>
        <span className="etiqueta">Balance general</span>
        <strong className="grande">{dinero(r.balance)}</strong>
        <p className="suave">
          {r.ingresos > 0
            ? `Has recuperado el ${numero(r.recuperado * 100)} % de lo que has gastado.`
            : "Aún no registras ventas. Todo lo que imprimes para ti cuenta como gasto."}
        </p>
        <Barra tono="bien" valor={r.recuperado} />
      </section>

      <section className="rejilla">
        <Cifra etiqueta="Dinero gastado" nota="impresora, filamento, luz y más" valor={dinero(r.gastado)} />
        <Cifra etiqueta="Vendido" nota={`${r.vendidas} piezas`} valor={dinero(r.ingresos)} />
        <Cifra
          etiqueta="Ganancia en ventas"
          nota="venta − costo real"
          tono={r.ganancia >= 0 ? "bien" : "mal"}
          valor={dinero(r.ganancia)}
        />
        <Cifra etiqueta="Uso personal" nota={`${r.propias} piezas (gasto)`} valor={dinero(r.costoPropio)} />
        <Cifra etiqueta="Impresiones fallidas" nota={`${r.fallas} intentos`} tono={r.fallas ? "mal" : undefined} valor={dinero(r.costoFallas)} />
        <Cifra etiqueta="Luz consumida" nota="estimada" valor={dinero(r.luz)} />
      </section>

      <section className="tarjeta">
        <h2>¿En qué se fue el dinero?</h2>
        <ul className="lista-simple">
          <li>
            <span>Impresora y mejoras</span>
            <b>{dinero(r.enImpresora)}</b>
          </li>
          <li>
            <span>Filamento comprado</span>
            <b>{dinero(r.enFilamento)}</b>
          </li>
          <li>
            <span>Refacciones, herramientas, insumos</span>
            <b>{dinero(r.enOtros)}</b>
          </li>
          <li>
            <span>Luz</span>
            <b>{dinero(r.luz)}</b>
          </li>
        </ul>
      </section>

      <section className="tarjeta">
        <h2>Filamento</h2>
        <p className="suave">
          Te quedan <b className="tinta">{gramos(r.filamentoRestanteG)}</b>, que valen {dinero(r.filamentoValor)}. Llevas{" "}
          {gramos(r.gramos)} impresos.
        </p>
        {porAcabar.length ? (
          <p className="aviso">
            Por acabarse: {porAcabar.map(({ x, queda }) => `${x.material} ${x.color} (${gramos(queda)})`).join(", ")}
          </p>
        ) : null}
      </section>

      <section className="tarjeta">
        <h2>Desgaste de la impresora</h2>
        <p className="suave">
          {numero(r.horas)} h de {numero(datos.ajustes.vidaImpresoraH)} h de vida estimada.
        </p>
        <Barra tono={r.vidaUsada > 0.8 ? "aviso" : undefined} valor={r.vidaUsada} />
      </section>
    </>
  );
}

function Cifra({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: string; nota?: string; tono?: "bien" | "mal" }) {
  return (
    <div className={`cifra ${tono ?? ""}`}>
      <span>{etiqueta}</span>
      <strong>{valor}</strong>
      {nota ? <small>{nota}</small> : null}
    </div>
  );
}
