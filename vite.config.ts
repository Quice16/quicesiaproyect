import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

// SPA build (Vite + TanStack Router) — desplegable en Vercel como sitio estático.
// El backend vive aparte en /server (Railway). El frontend lo consume vía VITE_API_URL.
export default defineConfig({
  plugins: [
    tsConfigPaths(),
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      generatedRouteTree: "src/routeTree.gen.ts",
      routesDirectory: "src/routes",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
