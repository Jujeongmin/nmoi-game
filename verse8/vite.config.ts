import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
// NMOI Caviar: the site itself is static (public/). The only bundled code is the
// Verse8 server bridge, emitted at a fixed path (shared/cv-server.js) so the static
// game pages in public/games can load it too.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  base: "./",
  build: {
    outDir: "dist",
    // Skip gzip-size reporting: our users don't optimize by bundle size,
    // and it only slows the build. Output is byte-identical.
    reportCompressedSize: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: {
        main: "index.html",
        "cv-server": "src/cv-server.ts",
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "cv-server" ? "shared/cv-server.js" : "assets/[name]-[hash].js",
      },
    },
  },
});
