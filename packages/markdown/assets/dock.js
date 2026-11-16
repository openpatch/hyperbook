/// <reference path="./hyperbook.types.js" />
/**
 * The dock: a drawer at the screen edge for working elements — IDEs,
 * drawings, text fields — that a reader wants in view while reading the
 * tasks. Docked elements are tabs in the drawer.
 *
 * Elements opt in at render time (`dock` on the directive, which sets
 * `data-dock` and `data-dock-label`). Docking never moves an element in the
 * DOM: it only positions it over the drawer with `position: fixed`. Moving it
 * would re-create React-based elements (Excalidraw) and reload iframes.
 *
 * Wide screens: the drawer sits on the right below the header, and the
 * article makes room for it. Narrow screens: it slides up from the bottom.
 */
(() => {
  const root = document.documentElement;
  const WIDTH_KEY = "hyperbook-dock-width";
  const HEIGHT_KEY = "hyperbook-dock-height";
  const pageKey = `hyperbook-dock:${location.pathname}`;
  const narrow = window.matchMedia("(max-width: 900px)");

  const t = (key, values, fallback) =>
    window.hyperbook?.i18n?.get?.(key, values, fallback) ?? fallback ?? key;

  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {}
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const setWidth = (px) =>
    root.style.setProperty(
      "--hb-dock-width",
      `${clamp(px, 320, window.innerWidth - 320)}px`,
    );
  const setHeight = (px) =>
    root.style.setProperty(
      "--hb-dock-height",
      `${clamp(px, 200, window.innerHeight - 100)}px`,
    );

  // Editors size themselves on window resize; a docked element changes size
  // without the window changing. Elements that watch their own box need
  // none of this.
  let relayoutTimer = 0;
  const relayout = (delay = 0) => {
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(
      () => window.dispatchEvent(new Event("resize")),
      delay,
    );
  };

  /**
   * @typedef {{
   *   el: HTMLElement,
   *   index: number,
   *   label: string,
   *   bar: HTMLElement,
   *   tab?: HTMLElement,
   * }} Dockable
   */

  /** @type {Dockable[]} */
  const items = [];
  /** @type {Dockable[]} in the order they were docked: the tab order. */
  let docked = [];
  /** @type {Dockable | null} */
  let active = null;
  let open = false;

  let frame, tabs, handle, handleLabel;

  function save() {
    if (!docked.length) return write(pageKey, null);
    write(
      pageKey,
      JSON.stringify({
        docked: docked.map((d) => d.index),
        active: active?.index,
        open,
      }),
    );
  }

  function render() {
    root.classList.toggle("hb-dock-has", docked.length > 0);
    root.classList.toggle("hb-dock-open", docked.length > 0 && open);
    frame.classList.toggle("open", open);

    tabs.replaceChildren(
      ...docked.map((d) => {
        if (!d.tab) d.tab = makeTab(d);
        const isActive = d === active;
        d.tab.classList.toggle("active", isActive);
        d.tab
          .querySelector(".hb-dock-tab-select")
          .setAttribute("aria-selected", String(isActive));
        return d.tab;
      }),
    );

    for (const d of items) {
      const isDocked = docked.includes(d);
      d.el.classList.toggle("hb-docked", isDocked);
      d.el.classList.toggle("hb-docked-active", isDocked && d === active);
      d.el.classList.toggle("hb-docked-open", isDocked && open);
      d.bar.classList.toggle("docked", isDocked);
      // The placeholder of what the dock shows right now.
      d.bar.classList.toggle("showing", isDocked && open && d === active);
      if (isDocked && d !== active) d.el.setAttribute("inert", "");
      else d.el.removeAttribute("inert");
    }

    handle.setAttribute("aria-expanded", String(open));
    handle.title = open ? t("dock-close") : t("dock-open");
    handle.setAttribute("aria-label", handle.title);
    save();
  }

  function dock(d) {
    if (!docked.includes(d)) docked.push(d);
    active = d;
    open = true;
    render();
    relayout(260);
  }

  function undock(d) {
    docked = docked.filter((x) => x !== d);
    if (active === d) active = docked[docked.length - 1] ?? null;
    if (!docked.length) open = false;
    render();
    relayout(260);
  }

  function show(d) {
    active = d;
    open = true;
    render();
    relayout(260);
  }

  function setOpen(value) {
    open = value;
    render();
    relayout(260);
  }

  function makeTab(d) {
    const tab = document.createElement("div");
    tab.className = "hb-dock-tab";
    tab.setAttribute("role", "presentation");

    const select = document.createElement("button");
    select.type = "button";
    select.className = "hb-dock-tab-select";
    select.setAttribute("role", "tab");
    select.textContent = d.label;
    select.addEventListener("click", () => show(d));

    const back = document.createElement("button");
    back.type = "button";
    back.className = "hb-dock-tab-back";
    back.title = t("dock-close-tab");
    back.setAttribute("aria-label", `${d.label}: ${t("dock-close-tab")}`);
    back.textContent = "×";
    back.addEventListener("click", () => undock(d));

    tab.append(select, back);
    return tab;
  }

  /**
   * The bar after each element. In the page, a "Dock" tab hanging off the
   * element's bottom edge; docked — the element has left the flow — a
   * one-line placeholder in its place: click it to show the element in the
   * dock, ↩ to bring it back.
   */
  function makeBar(d) {
    const bar = document.createElement("div");
    bar.className = "hb-dock-bar";

    const dockButton = document.createElement("button");
    dockButton.type = "button";
    dockButton.className = "hb-dock-aside";
    dockButton.title = `${d.label}: ${t("dock-move-aside-title")}`;
    const dockLabel = document.createElement("span");
    dockLabel.textContent = t("dock-move-aside");
    const dockChevron = document.createElement("span");
    dockChevron.className = "hb-dock-aside-chevron";
    dockChevron.setAttribute("aria-hidden", "true");
    dockChevron.textContent = "›";
    dockButton.append(dockLabel, dockChevron);
    dockButton.addEventListener("click", () => dock(d));

    const placeholder = document.createElement("div");
    placeholder.className = "hb-dock-placeholder";

    const showButton = document.createElement("button");
    showButton.type = "button";
    showButton.className = "hb-dock-show";
    showButton.title = t("dock-show");
    const showIcon = document.createElement("span");
    showIcon.className = "hb-dock-show-icon";
    showIcon.setAttribute("aria-hidden", "true");
    showIcon.textContent = "⇥";
    const showText = document.createElement("span");
    showText.textContent = t("dock-placeholder", { label: d.label });
    showButton.append(showIcon, showText);
    showButton.addEventListener("click", () => show(d));

    const backButton = document.createElement("button");
    backButton.type = "button";
    backButton.className = "hb-dock-back";
    backButton.title = t("dock-move-back");
    backButton.setAttribute("aria-label", `${d.label}: ${t("dock-move-back")}`);
    backButton.textContent = "↩";
    backButton.addEventListener("click", () => undock(d));

    placeholder.append(showButton, backButton);

    // Point at the element's tab in the dock while over its placeholder.
    placeholder.addEventListener("mouseenter", () =>
      d.tab?.classList.add("hover"),
    );
    placeholder.addEventListener("mouseleave", () =>
      d.tab?.classList.remove("hover"),
    );

    bar.append(dockButton, placeholder);
    return bar;
  }

  function makeFrame() {
    frame = document.createElement("div");
    frame.className = "hb-dock";

    const edge = document.createElement("div");
    edge.className = "hb-dock-edge";
    edge.title = t("dock-resize");

    handle = document.createElement("button");
    handle.type = "button";
    handle.className = "hb-dock-handle";
    const chevron = document.createElement("span");
    chevron.className = "hb-dock-chevron";
    chevron.setAttribute("aria-hidden", "true");
    handleLabel = document.createElement("span");
    handleLabel.className = "hb-dock-handle-label";
    handleLabel.textContent = t("dock-handle", undefined, "Dock");
    handle.append(chevron, handleLabel);
    handle.addEventListener("click", () => setOpen(!open));
    handle.addEventListener("pointerdown", (e) => e.stopPropagation());
    edge.append(handle);

    tabs = document.createElement("div");
    tabs.className = "hb-dock-tabs";
    tabs.setAttribute("role", "tablist");

    frame.append(edge, tabs);
    // Next to the docked elements, not on <body>: on wide screens the grid
    // is fixed and so its own stacking context, and a drawer outside it
    // would paint over everything docked inside it. It also picks up the
    // book's font there.
    (document.querySelector(".main-grid") || document.body).append(frame);

    // Drag the edge to resize.
    edge.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      edge.setPointerCapture(e.pointerId);
      const start = { x: e.clientX, y: e.clientY };
      const rect = frame.getBoundingClientRect();
      root.classList.add("hb-dock-resizing");
      const move = (ev) => {
        if (narrow.matches) setHeight(rect.height - (ev.clientY - start.y));
        else setWidth(rect.width - (ev.clientX - start.x));
        relayout();
      };
      const up = () => {
        edge.removeEventListener("pointermove", move);
        edge.removeEventListener("pointerup", up);
        root.classList.remove("hb-dock-resizing");
        const r = frame.getBoundingClientRect();
        if (narrow.matches) write(HEIGHT_KEY, String(r.height));
        else write(WIDTH_KEY, String(r.width));
      };
      edge.addEventListener("pointermove", move);
      edge.addEventListener("pointerup", up);
    });
  }

  function init() {
    const elements = [...document.querySelectorAll("[data-dock]")];
    if (!elements.length) return;

    const width = Number(read(WIDTH_KEY));
    if (width) setWidth(width);
    const height = Number(read(HEIGHT_KEY));
    if (height) setHeight(height);

    makeFrame();

    elements.forEach((el, index) => {
      /** @type {Dockable} */
      const d = {
        el,
        index,
        label: el.dataset.dockLabel || el.dataset.dock,
        bar: /** @type {HTMLElement} */ (/** @type {unknown} */ (null)),
      };
      d.bar = makeBar(d);
      // Inserting a sibling leaves the element where it is. After it: the
      // tab hangs off its bottom edge, and the placeholder takes its place.
      el.after(d.bar);
      items.push(d);
    });

    // Restore without the slide, so the drawer doesn't fly in on each page.
    root.classList.add("hb-dock-instant");
    try {
      const state = JSON.parse(read(pageKey) || "null");
      if (state) {
        docked = state.docked.map((i) => items[i]).filter(Boolean);
        active = items[state.active] ?? docked[docked.length - 1] ?? null;
        open = !!state.open && docked.length > 0;
      }
    } catch {}
    render();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("hb-dock-instant")),
    );
    if (docked.length) relayout(50);

    window.addEventListener("resize", (e) => {
      // Our own nudges are plain Events; only re-clamp on real resizes.
      if (!e.isTrusted) return;
      for (const [prop, set] of [
        ["--hb-dock-width", setWidth],
        ["--hb-dock-height", setHeight],
      ]) {
        const value = root.style.getPropertyValue(prop);
        if (value.endsWith("px")) set(parseFloat(value));
      }
    });
    narrow.addEventListener("change", () => relayout(50));
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
