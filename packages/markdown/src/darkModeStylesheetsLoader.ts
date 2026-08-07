/**
 * Writes the light and dark stylesheets into the page, honoring a mode the
 * reader picked before. The stylesheets sit in a noscript element, so they are
 * only text until this runs.
 *
 * This is inlined into the head instead of being loaded as a file. Nothing can
 * paint before the stylesheets are there, so an external script would put a
 * round trip in front of every first paint, and a second one in front of the
 * stylesheets it writes.
 *
 * © 2024 Google LLC. Licensed under the Apache License, Version 2.0.
 * https://www.apache.org/licenses/LICENSE-2.0
 */
export const darkModeStylesheetsLoader = `
// @license © 2024 Google LLC. Licensed under the Apache License, Version 2.0.
(() => {
  const ELEMENT_ID = 'dark-mode-toggle-stylesheets';
  const STORAGE_NAME = 'dark-mode-toggle';
  const LIGHT = 'light';
  const DARK = 'dark';

  let stylesheets = document.getElementById(ELEMENT_ID).textContent;

  let mode = null;
  try {
    mode = localStorage.getItem(STORAGE_NAME);
  } catch (e) {}

  const lightCSSMediaRegex = /\\(\\s*prefers-color-scheme\\s*:\\s*light\\s*\\)/gi;
  const darkCSSMediaRegex = /\\(\\s*prefers-color-scheme\\s*:\\s*dark\\s*\\)/gi;

  switch (mode) {
    case LIGHT:
      stylesheets = stylesheets
        .replace(lightCSSMediaRegex, '$&, all')
        .replace(darkCSSMediaRegex, '$& and not all');
      break;

    case DARK:
      stylesheets = stylesheets
        .replace(darkCSSMediaRegex, '$&, all')
        .replace(lightCSSMediaRegex, '$& and not all');
      break;
  }

  document.write(stylesheets);
})();
// @license-end`;
