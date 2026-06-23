import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0", // allow external access
    port: 5173,

    // Optional: if using newer Vite versions
    allowedHosts: true,

    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },

    hmr: {
      protocol: "wss",
      host: "YOUR_NGROK_DOMAIN.ngrok-free.app",
    },
  },
});