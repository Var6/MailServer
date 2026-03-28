import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
  server: {
    port: 5173,
    proxy: {
      // API → Docker api container (exposed on 127.0.0.1:3001 in docker-compose.apps.yml)
      "/api": { target: "http://localhost:3001", changeOrigin: true, rewrite: p => p.replace(/^\/api/, "") },
      // Nextcloud → Docker nginx
      "/nextcloud": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
  build: { outDir: "dist", sourcemap: false },
  test: {
    globals:     true,
    environment: "jsdom",
    setupFiles:  ["./src/test/setup.ts"],
    include:     ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include:  ["src/**/*.{ts,tsx}"],
      exclude:  ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/test/**"],
    },
  },
});
