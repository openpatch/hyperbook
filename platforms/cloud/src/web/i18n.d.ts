import type { Messages } from "../shared/i18n";

/** Makes i18next's t() accept exactly the keys of the shared catalog. */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: Messages;
    };
  }
}
