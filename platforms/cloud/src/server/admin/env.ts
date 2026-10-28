import type { SessionUser } from "../auth/sessions";

export type AdminEnv = {
  Variables: {
    user: SessionUser | null;
    sessionIdHash: string | null;
  };
};

/** Only after requireUser: the user is known to be set. */
export type AuthedEnv = {
  Variables: {
    user: SessionUser;
    sessionIdHash: string;
  };
};
