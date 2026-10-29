import { execFileSync } from "node:child_process";
import { cpSync, createReadStream, readFileSync, statSync } from "node:fs";
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

/**
 * Light or dark, as the reader chose (see src/web/lib/theme.ts) or else as the
 * system is set. Both go into the head of every page, so the first paint is
 * already in the right theme: the dark tokens, scoped to `:root.dark` (the
 * file books load is scoped to a media query instead), and the script setting
 * that class.
 */
function theme(): Plugin {
  const tokens = path.resolve(import.meta.dirname, "../../packages/markdown/assets/tokens-dark.css");
  const init = `(() => {
  let mode = null;
  try { mode = localStorage.getItem("dark-mode-toggle"); } catch {}
  const dark = mode === "dark" || (mode !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();`;
  return {
    name: "theme",
    transformIndexHtml() {
      return [
        { tag: "script", children: init, injectTo: "head-prepend" },
        { tag: "style", children: readFileSync(tokens, "utf8").replaceAll(":root", ":root.dark"), injectTo: "head" },
      ];
    },
  };
}

/**
 * The commit the platform is built from, shown in the sidebar. GIT_COMMIT
 * covers builds without a checkout (Docker passes it as a build argument).
 */
function gitCommit(): string | null {
  const fromEnv = process.env.GIT_COMMIT || process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: import.meta.dirname, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const { version } = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf8"));

export default defineConfig({
  root: "src/web",
  define: {
    __BUILD__: JSON.stringify({ version, commit: gitCommit(), run: process.env.GITHUB_RUN_NUMBER || null }),
  },
  plugins: [react(), tailwindcss(), excalidrawFonts(), theme()],
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
