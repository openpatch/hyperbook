/**
 * The platform keeps the file (`embedded`: no Save/Load buttons); images
 * exported from the toolbar are handed over as an event and downloaded here.
 */
export function embed(editor: HTMLElement, name: string) {
  editor.setAttribute("embedded", "");
  editor.addEventListener("export-image", (e) => {
    const { format, blob } = (e as CustomEvent<{ format: string; blob: Blob }>).detail;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
