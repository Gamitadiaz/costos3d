// Íconos propios en SVG: trazos simples que heredan el color del texto.
const TRAZOS = {
  resumen: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  impresiones: "M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 0v20M3 7l9 5 9-5",
  // Marco de la impresora con el cabezal sobre la pieza.
  impresoras: "M4 3v18M20 3v18M4 7h16M10 7v4h4V7M12 11v2M8 21v-4h8v4",
  inventario: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-6v6",
  ajustes:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.4 3h-4l-.3 2.4a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.3 2.4h4l.3-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z",
  mas: "M12 5v14M5 12h14",
  archivo: "M14 3H6v18h12V7l-4-4Zm0 0v4h4M9 13h6M9 17h6",
  cerrar: "M6 6l12 12M18 6 6 18",
  borrar: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  editar: "M4 20h4L19 9l-4-4L4 16v4Z",
  llave: "M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 1.3-1.3a4 4 0 0 0-5-5L3 10l3-3 3 3 1.3-1.3a4 4 0 0 1 5-5Z",
  respaldo: "M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3",
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, tamano = 20 }: { nombre: NombreIcono; tamano?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={tamano}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={tamano}
    >
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
