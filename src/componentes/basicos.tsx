import { useEffect, useState, type ReactNode } from "react";

// Campo numérico que deja escribir libremente ("1." o vacío) y solo avisa números válidos.
export function Numero({
  valor,
  onCambio,
  min = 0,
  paso = "any",
  sufijo,
  etiqueta,
}: {
  valor: number;
  onCambio: (n: number) => void;
  min?: number;
  paso?: string;
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
          min={min}
          onChange={(e) => {
            setTexto(e.target.value);
            const n = Number(e.target.value.replace(",", "."));
            if (e.target.value !== "" && Number.isFinite(n) && n >= min) onCambio(n);
            if (e.target.value === "") onCambio(0);
          }}
          step={paso}
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

export function Barra({ valor, tono }: { valor: number; tono?: "aviso" | "bien" }) {
  return (
    <div className={`barra ${tono ?? ""}`}>
      <div style={{ width: `${Math.max(0, Math.min(1, valor)) * 100}%` }} />
    </div>
  );
}

export function Encabezado({ titulo, sub }: { titulo: string; sub?: ReactNode }) {
  return (
    <header className="encabezado">
      <h1>{titulo}</h1>
      {sub ? <p>{sub}</p> : null}
    </header>
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
