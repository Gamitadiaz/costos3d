import "@fontsource-variable/archivo/wdth.css";
import "./estilos.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import { App } from "./App";

// Instala el "service worker": guarda la app para abrirla sin internet.
// (Solo funciona en https o localhost; por la IP de Tailscale se usa como página normal.)
registerSW({ immediate: true });

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
