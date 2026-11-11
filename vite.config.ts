import { defineConfig, loadEnv } from "vite";
import { existsSync, readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const previewEnabled =
    command === "serve" &&
    env.VITE_ENABLE_LOCAL_PREVIEW === "true" &&
    !env.VITE_SUPABASE_URL;
  return {
    plugins: [
      react(),
      {
        name: "ccih-private-preview",
        resolveId(id) {
          if (id === "virtual:ccih-preview") return "\0virtual:ccih-preview";
        },
        load(id) {
          if (id !== "\0virtual:ccih-preview") return;
          const path = ".private/preview-data.json";
          const data =
            previewEnabled && existsSync(path)
              ? JSON.parse(readFileSync(path, "utf8"))
              : [];
          return `export default ${JSON.stringify(data)};`;
        },
      },
    ],
    server: {
      fs: {
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem}",
          "**/.git/**",
          "**/.private/**",
          "**/.local/**",
          "**/outputs/**",
        ],
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ["recharts"],
          },
        },
      },
    },
  };
});
