var i18n = (function () {
  // LOCALES
  const locales = {};
  // LOCALES

  const get = (key, values) => {
    if (!locales[key]) {
      console.warn(
        `Missing translation for key '${key}'`
      );
      return key;
    }

    let translation = locales[key];
    if (values) {
      for (const [key, value] of Object.entries(values)) {
        translation = translation.replace(`{{${key}}}`, value);
      }
    }

    return translation;
  };

  return { get };
})();
