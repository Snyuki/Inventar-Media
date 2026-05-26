import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION ?? "dev"),
  },
  server: {
    host: true,
    allowedHosts: [
      "delicious-overheat-headway.ngrok-free.dev",  // replace with your ngrok URL
      "localhost",
    ],
    hmr: {
      port: 5174,
    },
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});