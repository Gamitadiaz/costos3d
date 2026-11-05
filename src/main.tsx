import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/jetbrains-mono";
import "./estilos.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";

// Instala el "service worker": guarda la app para abrirla sin internet.
// (Solo funciona en https o localhost; por la IP de Tailscale se usa como página normal.)
// Busca versión nueva al volver a la app y cada hora; al encontrarla se recarga sola.
registerSW({
  immediate: true,
  onRegisteredSW(_, registro) {
    if (!registro) return;
    setInterval(() => void registro.update(), 60 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void registro.update();
    });
  },
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
