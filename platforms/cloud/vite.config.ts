import { cpSync, createReadStream, statSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

/**
 * Excalidraw loads its fonts from a CDN unless told otherwise; the platform
 * serves them itself at /excalidraw-assets/fonts (see src/web/visual).
 */
function excalidrawFonts(): Plugin {
  const fonts = path.resolve(import.meta.dirname, "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
  const prefix = "/excalidraw-assets/fonts/";
  return {
    name: "excalidraw-fonts",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(prefix)) return next();
        const file = path.join(fonts, decodeURIComponent(req.url.slice(prefix.length).split("?")[0]!));
        if (!file.startsWith(fonts + path.sep) || !statSync(file, { throwIfNoEntry: false })?.isFile()) return next();
        res.setHeader("content-type", file.endsWith(".woff2") ? "font/woff2" : "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
    writeBundle(options) {
      cpSync(fonts, path.join(options.dir!, prefix), { recursive: true });
    },
  };
}

export default defineConfig({
  root: "src/web",
  plugins: [react(), tailwindcss(), excalidrawFonts()],
  resolve: {
    // CodeMirror and React break with two copies; other packages of the
    // repository pull in other versions (Excalidraw brings its own React).
    dedupe: ["@codemirror/state", "@codemirror/view", "@codemirror/language", "react", "react-dom"],
    alias: {
      "@": path.resolve(import.meta.dirname, "src/web"),
      // Hyperbook's design tokens, shared with the books themselves.
      "@hyperbook-tokens": path.resolve(
        import.meta.dirname,
        "../../packages/markdown/assets",
      ),
    },
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/web"),
    rollupOptions: {
      // visual.html hosts the elements' own editors in a frame (see src/web/visual).
      input: {
        main: path.resolve(import.meta.dirname, "src/web/index.html"),
        visual: path.resolve(import.meta.dirname, "src/web/visual.html"),
      },
    },
    emptyOutDir: true,
  },
  server: {
    // Change both with WEB_PORT / PORT if they are taken: pnpm dev reads them.
    port: Number(process.env.WEB_PORT || 5173),
    strictPort: true,
    // The Host header is passed through unchanged, so the server dispatches
    // these requests to the admin app (ADMIN_ORIGIN is this dev server).
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT || 3001}`,
        changeOrigin: false,
      },
    },
  },
});
