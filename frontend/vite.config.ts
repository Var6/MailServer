import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
  server: {
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true, rewrite: p => p.replace(/^\/api/, "") },
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
