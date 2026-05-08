/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // listen on 0.0.0.0 so ngrok can reach the dev server too
    // Allow any Host header (covers ngrok-free.app, custom domains, etc.)
    // Vite 5 defaults to localhost-only, which blocks ngrok requests.
    allowedHosts: true,
    proxy: {
      // In `npm run dev`, forward API calls to the server running on :4174.
      "/api": {
        target: "http://localhost:4174",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
});
