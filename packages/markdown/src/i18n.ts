import en from "../locales/en.json";
import de from "../locales/de.json";

let locales: Record<string, string> = {};

const init = (lang: string) => {
  if (lang === "de") {
    locales = de;
  } else {
    locales = en;
  }
};

const get = (key: string, values?: Record<string, string>) => {
  if (!locales[key]) {
    console.warn(`Missing translation for key '${key}'`);
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

export const i18n = {
  init,
  get,
};
