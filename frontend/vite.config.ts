import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8000",
      "/docs": "http://localhost:8000",
      "/regions": "http://localhost:8000",
      "/analyze": "http://localhost:8000",
      "/leaderboard": "http://localhost:8000",
      "/validate": "http://localhost:8000",
      "/gate": "http://localhost:8000",
      "/case-study": "http://localhost:8000",
    },
  },
  build: { outDir: "dist", sourcemap: true },
});
