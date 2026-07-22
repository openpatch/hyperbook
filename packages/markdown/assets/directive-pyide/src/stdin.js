/**
 * Reading a line of input without freezing the page.
 *
 * Pyodide runs on the main thread, so the classic `window.prompt()` route
 * blocks it: everything the script drew before asking sits in the canvas
 * bitmap unpainted, and queued turtle animation cannot drain, because the
 * browser never gets a chance to composite a frame. Instead we resolve input
 * from a field in the output panel and suspend Python on the promise (see
 * the JSPI shim in execution.js), which leaves the event loop free.
 *
 * `window.prompt()` remains the fallback where Python cannot be suspended.
 */

/** Per-IDE pending request, so a re-run or a stop can cancel a waiting read. */
const pending = new Map();

const parts = (id) => {
  const elem = document.getElementById(id);
  if (!elem) return null;
  const form = elem.getElementsByClassName("stdin")[0];
  const field = elem.getElementsByClassName("stdin-field")[0];
  if (!form || !field) return null;
  const label = elem.getElementsByClassName("stdin-prompt")[0] || null;
  return { form, field, label };
};

export const hideStdinField = (id) => {
  const found = parts(id);
  if (!found) return;
  found.form.classList.add("hidden");
  found.field.value = "";
  if (found.label) found.label.textContent = "";
};

/**
 * Resolve a waiting read early, e.g. because the run was stopped. Python then
 * sees the empty string, exactly as it would on EOF.
 */
export const cancelStdin = (id, value = "") => {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  entry.cleanup();
  hideStdinField(id);
  entry.resolve(value);
};

/**
 * Ask for a line of input via the in-page field.
 * @returns {Promise<string>} resolves once the learner submits.
 */
export const askStdinAsync = (id, promptText = "") => {
  const found = parts(id);
  // No field in the DOM (older markup): fall back to the blocking dialog.
  if (!found) return Promise.resolve(askStdinSync(id, promptText));

  cancelStdin(id);
  const { form, field, label } = found;
  if (label) label.textContent = String(promptText ?? "").trimEnd();

  return new Promise((resolve) => {
    const onSubmit = (event) => {
      event.preventDefault();
      const value = field.value;
      pending.delete(id);
      cleanup();
      hideStdinField(id);
      resolve(value);
    };
    const cleanup = () => form.removeEventListener("submit", onSubmit);

    pending.set(id, { resolve, cleanup });
    form.addEventListener("submit", onSubmit);
    form.classList.remove("hidden");
    field.value = "";
    field.focus();
    // Bring the prompt into view when the output panel has scrolled away.
    form.scrollIntoView?.({ block: "nearest" });
  });
};

/** Blocking fallback used when Python cannot be suspended. */
export const askStdinSync = (id, promptText = "") => {
  const text = promptText || hyperbook.i18n.get("pyide-input-prompt");
  const value = window.prompt(text);
  return value === null ? "" : value;
};
