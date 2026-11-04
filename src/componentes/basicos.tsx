import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { Icono } from "./iconos";

// Campo numérico que deja escribir libremente ("1." o vacío) y solo avisa números válidos.
export function Numero({
  valor,
  onCambio,
  min = 0,
  sufijo,
  etiqueta,
}: {
  valor: number;
  onCambio: (n: number) => void;
  min?: number;
  sufijo?: string;
  etiqueta: string;
}) {
  const [texto, setTexto] = useState(String(valor));

  useEffect(() => {
    if (Number(texto.replace(",", ".")) !== valor) setTexto(String(valor));
  }, [valor]);

  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <div className="entrada">
        <input
          inputMode="decimal"
          onChange={(e) => {
            setTexto(e.target.value);
            const n = Number(e.target.value.replace(",", "."));
            if (e.target.value === "") onCambio(0);
            else if (Number.isFinite(n) && n >= min) onCambio(n);
          }}
          type="text"
          value={texto}
        />
        {sufijo ? <em>{sufijo}</em> : null}
      </div>
    </label>
  );
}

export function Texto({
  valor,
  onCambio,
  etiqueta,
  tipo = "text",
  lista,
}: {
  valor: string;
  onCambio: (t: string) => void;
  etiqueta: string;
  tipo?: string;
  lista?: string;
}) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      <div className="entrada">
        <input list={lista} onChange={(e) => onCambio(e.target.value)} type={tipo} value={valor} />
      </div>
    </label>
  );
}

// Barra hecha de segmentos, como las capas de una impresión.
export function Barra({ valor, tono }: { valor: number; tono?: "aviso" }) {
  return (
    <div className={`barra ${tono ?? ""}`}>
      <div style={{ width: `${Math.max(0, Math.min(1, valor)) * 100}%` }} />
    </div>
  );
}

// Rollo de filamento visto de frente: el anillo de color se vacía según lo que queda.
export function Carrete({ hex, valor, tamano = 76 }: { hex: string; valor: number; tamano?: number }) {
  const v = Math.max(0, Math.min(1, valor));
  return (
    <i
      aria-hidden="true"
      className={`carrete ${v < 0.15 ? "bajo" : ""}`}
      style={{ "--color": hex, "--lleno": `${v * 360}deg`, "--tam": `${tamano}px` } as CSSProperties}
    />
  );
}

// Anillo de progreso (por ejemplo, cuánto has recuperado de lo invertido).
export function Anillo({ valor, children }: { valor: number; children?: ReactNode }) {
  const v = Math.max(0, Math.min(1, valor));
  return (
    <div className="anillo" style={{ "--lleno": `${v * 360}deg` } as CSSProperties}>
      <div>{children}</div>
    </div>
  );
}

export function Encabezado({ titulo, sub, accion }: { titulo: string; sub?: ReactNode; accion?: ReactNode }) {
  return (
    <header className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {accion}
    </header>
  );
}

// Tarjeta con rótulo pequeño tipo plano técnico: "01 · FILAMENTO".
export function Bloque({
  num,
  titulo,
  children,
  clase = "",
  accion,
}: {
  num?: string;
  titulo: string;
  children: ReactNode;
  clase?: string;
  accion?: ReactNode;
}) {
  return (
    <section className={`bloque ${clase}`}>
      <header>
        <h2>
          {num ? <span>{num}</span> : null}
          {titulo}
        </h2>
        {accion}
      </header>
      {children}
    </section>
  );
}

// Panel que entra por la derecha para crear o editar algo sin perder la vista de atrás.
export function Panel({ titulo, onCerrar, children, pie }: { titulo: string; onCerrar: () => void; children: ReactNode; pie?: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  return (
    <div className="panel-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <aside aria-label={titulo} className="panel" role="dialog">
        <header>
          <h2>{titulo}</h2>
          <button aria-label="Cerrar" className="icono-boton" onClick={onCerrar} type="button">
            <Icono nombre="cerrar" />
          </button>
        </header>
        <div className="panel-cuerpo">{children}</div>
        {pie ? <footer>{pie}</footer> : null}
      </aside>
    </div>
  );
}

export function Opciones<T extends string>({
  valor,
  opciones,
  onCambio,
}: {
  valor: T;
  opciones: Record<T, string>;
  onCambio: (v: T) => void;
}) {
  return (
    <div className="opciones" role="radiogroup">
      {(Object.keys(opciones) as T[]).map((k) => (
        <button aria-checked={valor === k} key={k} onClick={() => onCambio(k)} role="radio" type="button">
          {opciones[k]}
        </button>
      ))}
    </div>
  );
}
