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
      "list-coauthor-extras.ngrok-free.dev",
      "https://inventar-media-frontend.vercel.app",
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