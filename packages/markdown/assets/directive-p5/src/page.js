/**
 * Turns a p5 workspace into the document shown in the iframe: the p5 library
 * from the template, then every other JavaScript file in order, then the
 * sketch.
 */

/**
 * A sketch without setup() is a few drawing commands; give them a canvas,
 * as the p5.js editor does.
 * @param {string} code
 */
export const wrapSketch = (code) => {
  if (code !== "" && !code.includes("setup")) {
    return `
      function setup() {
        createCanvas(100, 100);
        background(200);
        ${code}
      }`;
  }
  return code;
};

/** Inline scripts end at the first `</script`, whatever surrounds it. */
const inlineScript = (code) =>
  `<script type="text/javascript">${code.replace(/<\/script/gi, "<\\/script")}</script>`;

/**
 * Seeds random() and noise() before setup(), so two runs of a sketch that
 * uses them draw the same picture. Wraps setup() instead of using p5's
 * add-on hooks, which differ between p5 1 and 2.
 */
const SEED_SCRIPT = `(() => {
  const setup = window.setup;
  if (typeof setup !== "function") return;
  window.setup = function (...args) {
    randomSeed(42);
    noiseSeed(42);
    return setup.apply(this, args);
  };
})();`;

/**
 * @param {string} template The page with a ###SCRIPTS### placeholder.
 * @param {{path: string, content?: string, role?: string}[]} files
 * @param {string} main
 * @param {{ seeded?: boolean }} [options] Seed randomness, for comparing.
 */
export const buildSketchPage = (template, files, main, { seeded = false } = {}) => {
  const scripts = files
    .filter(
      (file) =>
        file.path !== main &&
        !file.role &&
        typeof file.content === "string" &&
        /\.m?js$/.test(file.path),
    )
    .map((file) => inlineScript(file.content));
  const sketch = files.find((file) => file.path === main)?.content ?? "";
  scripts.push(inlineScript(wrapSketch(sketch)));
  if (seeded) scripts.push(inlineScript(SEED_SCRIPT));
  // A function replacement, so `$&` and friends in the code stay as written.
  return template
    .replace("###SCRIPTS###", () => scripts.join("\n"))
    .replace(/ /g, " ");
};

/**
 * Decodes the `data-workspace` attribute for a sketch shown without the IDE
 * shell.
 * @param {string | null} attribute
 */
export const decodeWorkspace = (attribute) => {
  if (!attribute) return { main: "sketch.js", files: [] };
  const bytes = Uint8Array.from(atob(attribute), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

/**
 * The files to render the solution: the reader's helper files, with the
 * solution in place of the main sketch.
 * @param {{path: string, content?: string, role?: string}[]} files
 * @param {string} main
 */
export const solutionFiles = (files, main) => {
  const solution = files.find((file) => file.role === "solution");
  if (!solution) return null;
  return files.map((file) =>
    file.path === main ? { ...file, content: solution.content ?? "" } : file,
  );
};
