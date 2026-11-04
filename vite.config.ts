import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// base "./": rutas relativas, así la app funciona igual desde la PC, GitHub Pages
// o, más adelante, la Raspberry Pi, sin importar en qué carpeta quede.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icono.svg"],
      manifest: {
        name: "Costos 3D",
        short_name: "Costos 3D",
        description: "Cuánto me cuesta de verdad cada impresión 3D",
        lang: "es-MX",
        theme_color: "#0e0f13",
        background_color: "#0e0f13",
        display: "standalone",
        start_url: ".",
        scope: ".",
        icons: [{ src: "icono.svg", sizes: "any", type: "image/svg+xml" }],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,woff2}"] },
    }),
  ],
});
