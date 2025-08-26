/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @license © 2019 Google LLC. Licensed under the Apache License, Version 2.0.
const doc = document;
let store = {};
try {
  store = localStorage;
} catch (err) {
  // Do nothing. The user probably blocks cookies.
}
const PREFERS_COLOR_SCHEME = 'prefers-color-scheme';
const MEDIA = 'media';
const LIGHT = 'light';
const DARK = 'dark';
const SYSTEM = 'system';
const MQ_DARK = `(${PREFERS_COLOR_SCHEME}:${DARK})`;
const MQ_LIGHT = `(${PREFERS_COLOR_SCHEME}:${LIGHT})`;
const LINK_REL_STYLESHEET = 'link[rel=stylesheet]';
const REMEMBER = 'remember';
const LEGEND = 'legend';
const TOGGLE = 'toggle';
const SWITCH = 'switch';
const THREE_WAY = 'three-way';
const APPEARANCE = 'appearance';
const PERMANENT = 'permanent';
const MODE = 'mode';
const COLOR_SCHEME_CHANGE = 'colorschemechange';
const PERMANENT_COLOR_SCHEME = 'permanentcolorscheme';
const ALL = 'all';
const NOT_ALL = 'not all';
const NAME = 'dark-mode-toggle';
const DEFAULT_URL = 'https://googlechromelabs.github.io/dark-mode-toggle/demo/';

// See https://html.spec.whatwg.org/multipage/common-dom-interfaces.html ↵
// #reflecting-content-attributes-in-idl-attributes.
const installStringReflection = (obj, attrName, propName = attrName) => {
  Object.defineProperty(obj, propName, {
    enumerable: true,
    get() {
      const value = this.getAttribute(attrName);
      return value === null ? '' : value;
    },
    set(v) {
      this.setAttribute(attrName, v);
    },
  });
};

const installBoolReflection = (obj, attrName, propName = attrName) => {
  Object.defineProperty(obj, propName, {
    enumerable: true,
    get() {
      return this.hasAttribute(attrName);
    },
    set(v) {
      if (v) {
        this.setAttribute(attrName, '');
      } else {
        this.removeAttribute(attrName);
      }
    },
  });
};

const template = doc.createElement('template');

template.innerHTML = `
<style>
  *,
  ::before,
  ::after {
    box-sizing: border-box;
  }

  :host {
    contain: content;
    display: block;
  }

  :host([hidden]) {
    display: none;
  }

  form {
    background-color: var(--${NAME}-background-color, transparent);
    color: var(--${NAME}-color, inherit);
    padding: 0;
  }

  fieldset {
    border: none;
    margin: 0;
    padding-block: 0.25rem;
    padding-inline: 0.25rem;
  }

  legend {
    font: var(--${NAME}-legend-font, inherit);
    padding: 0;
  }

  input,
  label {
    cursor: pointer;
  }

  label {
    white-space: nowrap;
  }

  input {
    opacity: 0;
    position: absolute;
    pointer-events: none;
  }

  input:focus-visible + label {
    outline: #e59700 auto 2px;
    outline: -webkit-focus-ring-color auto 5px;
  }

  label::before {
    content: "";
    display: inline-block;
    background-size: var(--${NAME}-icon-size, 1rem);
    background-repeat: no-repeat;
    height: var(--${NAME}-icon-size, 1rem);
    width: var(--${NAME}-icon-size, 1rem);
    vertical-align: middle;
  }

  label:not(:empty)::before {
    margin-inline-end: 0.5rem;
  }

  [part="toggleLabel"]::before {
    mask-image: var(--${NAME}-checkbox-icon, none);
    width: 24px;
    height: 24px;
    background-color: var(--color-brand-text);
  }

  [part="lightLabel"],
  [part="darkLabel"],
  [part="toggleLabel"],
  [part$="ThreeWayLabel"] {
    font: var(--${NAME}-label-font, inherit);
  }

  [part="lightLabel"]:empty,
  [part="darkLabel"]:empty,
  [part="toggleLabel"]:empty,
  [part$="ThreeWayLabel"]:empty {
    font-size: 0;
    padding: 0;
  }

  [part="permanentLabel"] {
    font: var(--${NAME}-remember-font, inherit);
  }

  input:checked + [part="permanentLabel"]::before {
    background-image: var(--${NAME}-remember-icon-checked, url("${DEFAULT_URL}checked.svg"));
  }

  input:checked + [part="darkLabel"],
  input:checked + [part="lightLabel"],
  input:checked + [part$="ThreeWayLabel"] {
    background-color: var(--${NAME}-active-mode-background-color, transparent);
  }

  input:checked + [part="darkLabel"]::before,
  input:checked + [part="lightLabel"]::before,
  input:checked + [part$="ThreeWayLabel"]::before {
    background-color: var(--${NAME}-active-mode-background-color, transparent);
  }

  input:checked + [part="toggleLabel"]::before, input[part="toggleCheckbox"]:checked ~ [part="threeWayRadioWrapper"] [part$="ThreeWayLabel"]::before {
    filter: var(--${NAME}-icon-filter, none);
  }

  input:checked + [part="toggleLabel"] ~ aside [part="permanentLabel"]::before {
    filter: var(--${NAME}-remember-filter, invert(100%));
  }

  aside {
    visibility: hidden;
    margin-block-start: 0.15rem;
  }

  [part="lightLabel"]:focus-visible ~ aside,
  [part="darkLabel"]:focus-visible ~ aside,
  [part="toggleLabel"]:focus-visible ~ aside {
    visibility: visible;
    transition: visibility 0s;
  }

  aside [part="permanentLabel"]:empty {
    display: none;
  }

  @media (hover: hover) {
    aside {
      transition: visibility 3s;
    }

    aside:hover {
      visibility: visible;
    }

    [part="lightLabel"]:hover ~ aside,
    [part="darkLabel"]:hover ~ aside,
    [part="toggleLabel"]:hover ~ aside {
      visibility: visible;
      transition: visibility 0s;
    }
  }
</style>
<form part="form">
  <fieldset part="fieldset">
    <legend part="legend"></legend>
    <input part="lightRadio" id="l" name="mode" type="radio">
    <label part="lightLabel" for="l"></label>
    <input part="darkRadio" id="d" name="mode" type="radio">
    <label  part="darkLabel" for="d"></label>
    <input part="toggleCheckbox" id="t" type="checkbox">
    <label part="toggleLabel" for="t"></label>
    <span part="threeWayRadioWrapper">
      <input part="lightThreeWayRadio" id="3l" name="three-way-mode" type="radio">
      <label part="lightThreeWayLabel" for="3l"></label>
      <input part="systemThreeWayRadio" id="3s" name="three-way-mode" type="radio">
      <label part="systemThreeWayLabel" for="3s"></label>
      <input part="darkThreeWayRadio" id="3d" name="three-way-mode" type="radio">
      <label part="darkThreeWayLabel" for="3d"></label>
    </span>
    <aside part="aside">
      <input part="permanentCheckbox" id="p" type="checkbox">
      <label part="permanentLabel" for="p"></label>
    </aside>
  </fieldset>
</form>
`

export class DarkModeToggle extends HTMLElement {
  static get observedAttributes() {
    return [MODE, APPEARANCE, PERMANENT, LEGEND, LIGHT, DARK, REMEMBER];
  }

  constructor() {
    super();

    installStringReflection(this, MODE);
    installStringReflection(this, APPEARANCE);
    installStringReflection(this, LEGEND);
    installStringReflection(this, LIGHT);
    installStringReflection(this, DARK);
    installStringReflection(this, SYSTEM);
    installStringReflection(this, REMEMBER);

    installBoolReflection(this, PERMANENT);

    this._darkCSS = null;
    this._lightCSS = null;

    doc.addEventListener(COLOR_SCHEME_CHANGE, (event) => {
      this.mode = event.detail.colorScheme;
      this._updateRadios();
      this._updateCheckbox();
      this._updateThreeWayRadios();
    });

    doc.addEventListener(PERMANENT_COLOR_SCHEME, (event) => {
      this.permanent = event.detail.permanent;
      this._permanentCheckbox.checked = this.permanent;
      this._updateThreeWayRadios();
    });

    this._initializeDOM();
  }

  _initializeDOM() {
    const shadowRoot = this.attachShadow({ mode: 'open' });
    shadowRoot.append(template.content.cloneNode(true));

    // We need to support `media="(prefers-color-scheme: dark)"` (with space)
    // and `media="(prefers-color-scheme:dark)"` (without space)
    this._darkCSS = doc.querySelectorAll(
      `${LINK_REL_STYLESHEET}[${MEDIA}*=${PREFERS_COLOR_SCHEME}][${MEDIA}*="${DARK}"]`,
    );
    this._lightCSS = doc.querySelectorAll(
      `${LINK_REL_STYLESHEET}[${MEDIA}*=${PREFERS_COLOR_SCHEME}][${MEDIA}*="${LIGHT}"]`,
    );

    // Get DOM references.
    this._lightRadio = shadowRoot.querySelector('[part=lightRadio]');
    this._lightLabel = shadowRoot.querySelector('[part=lightLabel]');
    this._darkRadio = shadowRoot.querySelector('[part=darkRadio]');
    this._darkLabel = shadowRoot.querySelector('[part=darkLabel]');
    this._darkCheckbox = shadowRoot.querySelector('[part=toggleCheckbox]');
    this._checkboxLabel = shadowRoot.querySelector('[part=toggleLabel]');
    this._lightThreeWayRadio = shadowRoot.querySelector(
      '[part=lightThreeWayRadio]',
    );
    this._lightThreeWayLabel = shadowRoot.querySelector(
      '[part=lightThreeWayLabel]',
    );
    this._systemThreeWayRadio = shadowRoot.querySelector(
      '[part=systemThreeWayRadio]',
    );
    this._systemThreeWayLabel = shadowRoot.querySelector(
      '[part=systemThreeWayLabel]',
    );
    this._darkThreeWayRadio = shadowRoot.querySelector(
      '[part=darkThreeWayRadio]',
    );
    this._darkThreeWayLabel = shadowRoot.querySelector(
      '[part=darkThreeWayLabel]',
    );
    this._legendLabel = shadowRoot.querySelector('legend');
    this._permanentAside = shadowRoot.querySelector('aside');
    this._permanentCheckbox = shadowRoot.querySelector(
      '[part=permanentCheckbox]',
    );
    this._permanentLabel = shadowRoot.querySelector('[part=permanentLabel]');
  }

  connectedCallback() {
    // Does the browser support native `prefers-color-scheme`?
    const hasNativePrefersColorScheme = matchMedia(MQ_DARK).media !== NOT_ALL;
    // Listen to `prefers-color-scheme` changes.
    if (hasNativePrefersColorScheme) {
      matchMedia(MQ_DARK).addListener(({ matches }) => {
        if (this.permanent) {
          return;
        }
        this.mode = matches ? DARK : LIGHT;
        this._dispatchEvent(COLOR_SCHEME_CHANGE, { colorScheme: this.mode });
      });
    }
    // Set initial state, giving preference to a remembered value, then the
    // native value (if supported), and eventually defaulting to a light
    // experience.
    let rememberedValue = false;
    try {
      rememberedValue = store.getItem(NAME);
    } catch (err) {
      // Do nothing. The user probably blocks cookies.
    }
    if (rememberedValue && [DARK, LIGHT].includes(rememberedValue)) {
      this.mode = rememberedValue;
      this._permanentCheckbox.checked = true;
      this.permanent = true;
    } else if (hasNativePrefersColorScheme) {
      this.mode = matchMedia(MQ_LIGHT).matches ? LIGHT : DARK;
    }
    if (!this.mode) {
      this.mode = LIGHT;
    }
    if (this.permanent && !rememberedValue) {
      try {
        store.setItem(NAME, this.mode);
      } catch (err) {
        // Do nothing. The user probably blocks cookies.
      }
    }

    // Default to toggle appearance.
    if (!this.appearance) {
      this.appearance = TOGGLE;
    }

    // Update the appearance to toggle, switch or three-way.
    this._updateAppearance();

    // Update the radios
    this._updateRadios();

    // Make the checkbox reflect the state of the radios
    this._updateCheckbox();

    // Make the 3 way radio reflect the state of the radios
    this._updateThreeWayRadios();

    // Synchronize the behavior of the radio and the checkbox.
    [this._lightRadio, this._darkRadio].forEach((input) => {
      input.addEventListener('change', () => {
        this.mode = this._lightRadio.checked ? LIGHT : DARK;
        this._updateCheckbox();
        this._updateThreeWayRadios();
        this._dispatchEvent(COLOR_SCHEME_CHANGE, { colorScheme: this.mode });
      });
    });
    this._darkCheckbox.addEventListener('change', () => {
      this.mode = this._darkCheckbox.checked ? DARK : LIGHT;
      this._updateRadios();
      this._updateThreeWayRadios();
      this._dispatchEvent(COLOR_SCHEME_CHANGE, { colorScheme: this.mode });
    });
    this._lightThreeWayRadio.addEventListener('change', () => {
      this.mode = LIGHT;
      this.permanent = true;
      this._updateCheckbox();
      this._updateRadios();
      this._updateThreeWayRadios();
      this._dispatchEvent(COLOR_SCHEME_CHANGE, { colorScheme: this.mode });
      this._dispatchEvent(PERMANENT_COLOR_SCHEME, {
        permanent: this.permanent,
      });
    });
    this._darkThreeWayRadio.addEventListener('change', () => {
      this.mode = DARK;
      this.permanent = true;
      this._updateCheckbox();
      this._updateRadios();
      this._updateThreeWayRadios();
      this._dispatchEvent(COLOR_SCHEME_CHANGE, { colorScheme: this.mode });
      this._dispatchEvent(PERMANENT_COLOR_SCHEME, {
        permanent: this.permanent,
      });
    });
    this._systemThreeWayRadio.addEventListener('change', () => {
      this.mode = this._getPrefersColorScheme();
      this.permanent = false;
      this._updateCheckbox();
      this._updateRadios();
      this._updateThreeWayRadios();
      this._dispatchEvent(COLOR_SCHEME_CHANGE, { colorScheme: this.mode });
      this._dispatchEvent(PERMANENT_COLOR_SCHEME, {
        permanent: this.permanent,
      });
    });
    // Make remembering the last mode optional
    this._permanentCheckbox.addEventListener('change', () => {
      this.permanent = this._permanentCheckbox.checked;
      this._updateThreeWayRadios();
      this._dispatchEvent(PERMANENT_COLOR_SCHEME, {
        permanent: this.permanent,
      });
    });

    // Finally update the mode and let the world know what's going on
    this._updateMode();
    this._dispatchEvent(COLOR_SCHEME_CHANGE, { colorScheme: this.mode });
    this._dispatchEvent(PERMANENT_COLOR_SCHEME, {
      permanent: this.permanent,
    });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === MODE) {
      const allAttributes = [LIGHT, SYSTEM, DARK];
      if (!allAttributes.includes(newValue)) {
        throw new RangeError(
          `Allowed values are: "${allAttributes.join(`", "`)}".`,
        );
      }
      // Only show the dialog programmatically on devices not capable of hover
      // and only if there is a label
      if (matchMedia('(hover:none)').matches && this.remember) {
        this._showPermanentAside();
      }
      if (this.permanent) {
        try {
          store.setItem(NAME, this.mode);
        } catch (err) {
          // Do nothing. The user probably blocks cookies.
        }
      }
      this._updateRadios();
      this._updateCheckbox();
      this._updateThreeWayRadios();
      this._updateMode();
    } else if (name === APPEARANCE) {
      const allAppearanceOptions = [TOGGLE, SWITCH, THREE_WAY];
      if (!allAppearanceOptions.includes(newValue)) {
        throw new RangeError(
          `Allowed values are: "${allAppearanceOptions.join(`", "`)}".`,
        );
      }
      this._updateAppearance();
    } else if (name === PERMANENT) {
      if (this.permanent) {
        if (this.mode) {
          try {
            store.setItem(NAME, this.mode);
          } catch (err) {
            // Do nothing. The user probably blocks cookies.
          }
        }
      } else {
        try {
          store.removeItem(NAME);
        } catch (err) {
          // Do nothing. The user probably blocks cookies.
        }
      }
      this._permanentCheckbox.checked = this.permanent;
    } else if (name === LEGEND) {
      this._legendLabel.textContent = newValue;
    } else if (name === REMEMBER) {
      this._permanentLabel.textContent = newValue;
    } else if (name === LIGHT) {
      this._lightLabel.textContent = newValue;
      if (this.mode === LIGHT) {
        this._checkboxLabel.textContent = newValue;
      }
    } else if (name === DARK) {
      this._darkLabel.textContent = newValue;
      if (this.mode === DARK) {
        this._checkboxLabel.textContent = newValue;
      }
    }
  }

  _getPrefersColorScheme() {
    return matchMedia(MQ_LIGHT).matches ? LIGHT : DARK;
  }

  _dispatchEvent(type, value) {
    this.dispatchEvent(
      new CustomEvent(type, {
        bubbles: true,
        composed: true,
        detail: value,
      }),
    );
  }

  _updateAppearance() {
    // Hide or show the light-related affordances dependent on the appearance,
    // which can be "switch" , "toggle" or "three-way".
    this._lightRadio.hidden =
      this._lightLabel.hidden =
      this._darkRadio.hidden =
      this._darkLabel.hidden =
      this._darkCheckbox.hidden =
      this._checkboxLabel.hidden =
      this._lightThreeWayRadio.hidden =
      this._lightThreeWayLabel.hidden =
      this._systemThreeWayRadio.hidden =
      this._systemThreeWayLabel.hidden =
      this._darkThreeWayRadio.hidden =
      this._darkThreeWayLabel.hidden =
        true;
    switch (this.appearance) {
      case SWITCH:
        this._lightRadio.hidden =
          this._lightLabel.hidden =
          this._darkRadio.hidden =
          this._darkLabel.hidden =
            false;
        break;
      case THREE_WAY:
        this._lightThreeWayRadio.hidden =
          this._lightThreeWayLabel.hidden =
          this._systemThreeWayRadio.hidden =
          this._systemThreeWayLabel.hidden =
          this._darkThreeWayRadio.hidden =
          this._darkThreeWayLabel.hidden =
            false;
        break;
      case TOGGLE:
      default:
        this._darkCheckbox.hidden = this._checkboxLabel.hidden = false;
        break;
    }
  }

  _updateRadios() {
    if (this.mode === LIGHT) {
      this._lightRadio.checked = true;
    } else {
      this._darkRadio.checked = true;
    }
  }

  _updateCheckbox() {
    if (this.mode === LIGHT) {
      this._checkboxLabel.style.setProperty(
        `--${NAME}-checkbox-icon`,
        `url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItbW9vbiI+PHBhdGggZD0iTTIxIDEyLjc5QTkgOSAwIDEgMSAxMS4yMSAzIDcgNyAwIDAgMCAyMSAxMi43OXoiPjwvcGF0aD48L3N2Zz4=)`,
      );
      this._checkboxLabel.textContent = this.light;
      if (!this.light) {
        this._checkboxLabel.ariaLabel = DARK;
      }
      this._darkCheckbox.checked = false;
    } else {
      this._checkboxLabel.style.setProperty(
        `--${NAME}-checkbox-icon`,
        `url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItc3VuIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI1Ij48L2NpcmNsZT48bGluZSB4MT0iMTIiIHkxPSIxIiB4Mj0iMTIiIHkyPSIzIj48L2xpbmU+PGxpbmUgeDE9IjEyIiB5MT0iMjEiIHgyPSIxMiIgeTI9IjIzIj48L2xpbmU+PGxpbmUgeDE9IjQuMjIiIHkxPSI0LjIyIiB4Mj0iNS42NCIgeTI9IjUuNjQiPjwvbGluZT48bGluZSB4MT0iMTguMzYiIHkxPSIxOC4zNiIgeDI9IjE5Ljc4IiB5Mj0iMTkuNzgiPjwvbGluZT48bGluZSB4MT0iMSIgeTE9IjEyIiB4Mj0iMyIgeTI9IjEyIj48L2xpbmU+PGxpbmUgeDE9IjIxIiB5MT0iMTIiIHgyPSIyMyIgeTI9IjEyIj48L2xpbmU+PGxpbmUgeDE9IjQuMjIiIHkxPSIxOS43OCIgeDI9IjUuNjQiIHkyPSIxOC4zNiI+PC9saW5lPjxsaW5lIHgxPSIxOC4zNiIgeTE9IjUuNjQiIHgyPSIxOS43OCIgeTI9IjQuMjIiPjwvbGluZT48L3N2Zz4=)`,
      );
      this._checkboxLabel.textContent = this.dark;
      if (!this.dark) {
        this._checkboxLabel.ariaLabel = LIGHT;
      }
      this._darkCheckbox.checked = true;
    }
  }

  _updateThreeWayRadios() {
    this._lightThreeWayLabel.ariaLabel = LIGHT;
    this._systemThreeWayLabel.ariaLabel = SYSTEM;
    this._lightThreeWayLabel.ariaLabel = DARK;
    this._lightThreeWayLabel.textContent = this.light;
    this._systemThreeWayLabel.textContent = this.system;
    this._darkThreeWayLabel.textContent = this.dark;
    if (this.permanent) {
      if (this.mode === LIGHT) {
        this._lightThreeWayRadio.checked = true;
      } else {
        this._darkThreeWayRadio.checked = true;
      }
    } else {
      this._systemThreeWayRadio.checked = true;
    }
  }

  _updateMode() {
    if (this.mode === LIGHT) {
      this._lightCSS.forEach((link) => {
        link.media = ALL;
        link.disabled = false;
      });
      this._darkCSS.forEach((link) => {
        link.media = NOT_ALL;
        link.disabled = true;
      });
    } else {
      this._darkCSS.forEach((link) => {
        link.media = ALL;
        link.disabled = false;
      });
      this._lightCSS.forEach((link) => {
        link.media = NOT_ALL;
        link.disabled = true;
      });
    }
  }

  _showPermanentAside() {
    this._permanentAside.style.visibility = 'visible';
    setTimeout(() => {
      this._permanentAside.style.visibility = 'hidden';
    }, 3000);
  }
}

customElements.define(NAME, DarkModeToggle);
