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
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ["react", "react-dom", "react-router-dom"],
          query:   ["@tanstack/react-query"],
          editor:  [
            "@tiptap/react", "@tiptap/starter-kit",
            "@tiptap/extension-underline", "@tiptap/extension-text-align",
            "@tiptap/extension-link", "@tiptap/extension-placeholder",
            "@tiptap/extension-text-style", "@tiptap/extension-color",
          ],
          icons: ["lucide-react"],
        },
      },
    },
  },
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
