// Lector mínimo de ZIP (un .3mf es un ZIP). Solo saca los archivos que se le piden y los
// descomprime con lo que ya trae el navegador (DecompressionStream), sin librerías.

const FIN = 0x06054b50;
const FIN64 = 0x06064b50;
const LOCALIZADOR64 = 0x07064b50;
const CENTRAL = 0x02014b50;
const MAX = 0xffffffff;

type Entrada = { metodo: number; comprimido: number; inicio: number };

function indice(v: DataView) {
  // El directorio del ZIP está al final: se busca su firma de atrás hacia adelante.
  let fin = -1;
  for (let i = v.byteLength - 22; i >= Math.max(0, v.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === FIN) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error("No es un archivo ZIP/3MF válido.");

  let total = v.getUint16(fin + 10, true);
  let pos = v.getUint32(fin + 16, true);
  // ZIP64: archivos grandes guardan las posiciones en otro registro.
  if (pos === MAX && fin >= 20 && v.getUint32(fin - 20, true) === LOCALIZADOR64) {
    const fin64 = Number(v.getBigUint64(fin - 12, true));
    if (v.getUint32(fin64, true) === FIN64) {
      total = Number(v.getBigUint64(fin64 + 32, true));
      pos = Number(v.getBigUint64(fin64 + 48, true));
    }
  }

  const entradas = new Map<string, Entrada>();
  const texto = new TextDecoder();
  for (let n = 0; n < total && v.getUint32(pos, true) === CENTRAL; n++) {
    const metodo = v.getUint16(pos + 10, true);
    let comprimido = v.getUint32(pos + 20, true);
    let tamano = v.getUint32(pos + 24, true);
    const largoNombre = v.getUint16(pos + 28, true);
    const largoExtra = v.getUint16(pos + 30, true);
    const largoComentario = v.getUint16(pos + 32, true);
    let local = v.getUint32(pos + 42, true);
    const nombre = texto.decode(new Uint8Array(v.buffer, v.byteOffset + pos + 46, largoNombre));

    // Campo extra ZIP64: trae, en orden, los valores que arriba quedaron en 0xFFFFFFFF.
    let e = pos + 46 + largoNombre;
    const finExtra = e + largoExtra;
    while (e + 4 <= finExtra) {
      const id = v.getUint16(e, true);
      const largo = v.getUint16(e + 2, true);
      if (id === 1) {
        let p = e + 4;
        const leer64 = () => {
          const x = Number(v.getBigUint64(p, true));
          p += 8;
          return x;
        };
        if (tamano === MAX) tamano = leer64();
        if (comprimido === MAX) comprimido = leer64();
        if (local === MAX) local = leer64();
      }
      e += 4 + largo;
    }

    // Los datos empiezan después del encabezado local, que tiene su propio nombre y extra.
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    entradas.set(nombre, { metodo, comprimido, inicio });
    pos = finExtra + largoComentario;
  }
  return entradas;
}

async function sacar(datos: ArrayBuffer, x: Entrada) {
  const crudo = new Uint8Array(datos, x.inicio, x.comprimido);
  if (x.metodo === 0) return crudo;
  if (x.metodo !== 8) throw new Error("Compresión de ZIP no soportada.");
  const flujo = new Blob([crudo]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

// Devuelve el texto de los archivos pedidos que existan dentro del ZIP.
export async function leerZip(datos: ArrayBuffer, nombres: (n: string) => boolean) {
  const v = new DataView(datos);
  const textos = new Map<string, string>();
  for (const [nombre, entrada] of indice(v)) {
    if (nombres(nombre)) textos.set(nombre, new TextDecoder().decode(await sacar(datos, entrada)));
  }
  return textos;
}
