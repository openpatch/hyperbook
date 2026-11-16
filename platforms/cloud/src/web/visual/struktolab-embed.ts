/**
 * The platform keeps the file (`embedded`: no Save/Load buttons); images
 * exported from the toolbar are handed over as an event and downloaded here.
 */
export function embed(editor: HTMLElement, name: string) {
  editor.setAttribute("embedded", "");
  // Its View menu opens to the left of its button, at the start of the
  // toolbar, and the frame cuts it off; it opens to the right here, until
  // struktolab does so itself (fixed upstream after 0.8.1).
  const style = document.createElement("style");
  style.textContent = ".popover { left: 0; right: auto; }";
  editor.shadowRoot?.append(style);
  editor.addEventListener("export-image", (e) => {
    const { format, blob } = (e as CustomEvent<{ format: string; blob: Blob }>).detail;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
