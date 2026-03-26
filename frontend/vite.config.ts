import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteSingleFile(), // inlines all CSS + JS into the HTML
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist-export",
    // Prevent code splitting so everything is inlined as one chunk
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    // Raise the inline limit so assets (icons, small images) get inlined too
    assetsInlineLimit: 100_000_000,
  },
});
