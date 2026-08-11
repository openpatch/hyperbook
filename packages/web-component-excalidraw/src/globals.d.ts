// @excalidraw/excalidraw exposes ./index.css only under the "development" and
// "production" export conditions, which TypeScript's resolver does not follow.
// Vite resolves it correctly at build time; this just satisfies the type check.
declare module "@excalidraw/excalidraw/index.css";
