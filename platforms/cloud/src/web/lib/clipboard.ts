/**
 * Copies text to the clipboard and says whether that worked.
 *
 * The Clipboard API exists only in secure contexts, and schools often run
 * their instance over plain http. There the old `execCommand("copy")` still
 * works. The helper textarea goes next to the focused element, so a dialog's
 * focus trap does not pull the focus (and the selection) away from it.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Denied or not focused: try the old way.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.opacity = "0";
  const host = document.activeElement?.parentElement ?? document.body;
  const previous = document.activeElement as HTMLElement | null;
  host.append(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    previous?.focus?.();
  }
}
