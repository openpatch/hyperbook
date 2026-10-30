import type { SessionUser } from "../auth/sessions";
import type { Locale } from "../../shared/i18n";

export type AdminEnv = {
  Variables: {
    user: SessionUser | null;
    sessionIdHash: string | null;
    /** Resolved by localeMiddleware: user choice, else instance default, else Accept-Language. */
    locale: Locale;
  };
};

/** Only after requireUser: the user is known to be set. */
export type AuthedEnv = {
  Variables: {
    user: SessionUser;
    sessionIdHash: string;
    locale: Locale;
  };
};
