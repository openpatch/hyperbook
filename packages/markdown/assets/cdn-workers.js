// CDN modules may create workers beside their own scripts. A local bootstrap
// lets those workers load their CDN code while retaining the book's origin.
(function () {
  const NativeWorker = window.Worker;
  if (!NativeWorker) return;
  window.Worker = class extends NativeWorker {
    constructor(script, options = {}) {
      const url = new URL(script, document.baseURI);
      let bootstrap;
      if (
        /^https?:$/.test(url.protocol) &&
        url.origin !== window.location.origin
      ) {
        const remote = JSON.stringify(url.href);
        // Some workers resolve WASM beside self.location rather than import.meta.
        // Preserve their original script URL while the bootstrap uses a Blob.
        const location = `Object.defineProperty(self, "location", { value: new URL(${remote}) });`;
        const source =
          options?.type === "module"
            ? `${location}
             const pending = [];
             const queue = event => pending.push(event);
             self.addEventListener("message", queue);
             await import(${remote});
             self.removeEventListener("message", queue);
             for (const event of pending) self.dispatchEvent(event);`
            : `${location} importScripts(${remote});`;
        bootstrap = URL.createObjectURL(
          new Blob([source], { type: "text/javascript" }),
        );
      }
      super(bootstrap || script, options);
      this.releaseBootstrap = () => {
        if (bootstrap) URL.revokeObjectURL(bootstrap);
        bootstrap = undefined;
      };
      this.addEventListener("message", this.releaseBootstrap, { once: true });
      this.addEventListener("error", this.releaseBootstrap, { once: true });
    }
    terminate() {
      this.releaseBootstrap();
      super.terminate();
    }
  };
})();
