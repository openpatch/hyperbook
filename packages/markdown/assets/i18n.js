/// <reference path="./hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

/**
 * Internationalization module providing translation lookups.
 * @type {HyperbookI18n}
 * @memberof hyperbook
 */
hyperbook.i18n = (function () {
  // LOCALES
  const locales = {};
  // LOCALES

  /**
   * Get a translated string by key, with optional placeholder substitution.
   * @param {string} key - The translation key.
   * @param {Record<string, string>} [values] - Placeholder values to substitute.
   * @param {string} [fallback] - Used when the key has no translation. Without
   *   it the key itself is rendered, which surfaces raw ids like
   *   "user-save-conflict" in the UI.
   * @returns {string} The translated string, the fallback, or the key.
   */
  const get = (key, values, fallback) => {
    if (!locales[key]) {
      console.warn(
        `Missing translation for key '${key}'`
      );
      if (fallback === undefined) return key;
      return substitute(fallback, values);
    }

    return substitute(locales[key], values);
  };

  const substitute = (translation, values) => {
    if (values) {
      for (const [key, value] of Object.entries(values)) {
        translation = translation.replace(`{{${key}}}`, value);
      }
    }

    return translation;
  };

  return { get };
})();
