import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { readSession, SESSION_LIFETIME_MS } from "../auth/sessions";
import type { Deps } from "../deps";
import type { AdminEnv, AuthedEnv } from "./env";

/*
 * The cookie is __Host-hb_session: Secure, no Domain, Path=/. Browsers then
 * refuse to let any other host (such as a book on a sibling subdomain) set or
 * overwrite it.
 */
const COOKIE = "hb_session";

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, COOKIE, token, {
    prefix: "host",
    httpOnly: true,
    sameSite: "Lax",
    maxAge: Math.floor(SESSION_LIFETIME_MS / 1000),
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { prefix: "host" });
}

export function sessionMiddleware({ db }: Deps) {
  return createMiddleware<AdminEnv>(async (c, next) => {
    const token = getCookie(c, COOKIE, "host");
    const session = token ? readSession(db, token) : null;
    c.set("user", session?.user ?? null);
    c.set("sessionIdHash", session?.idHash ?? null);
    await next();
  });
}

export const requireUser = createMiddleware<AuthedEnv>(async (c, next) => {
  if (!c.get("user")) throw new HTTPException(401, { message: "Not logged in" });
  await next();
});

export const requireAdmin = createMiddleware<AuthedEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "Not logged in" });
  if (user.role !== "admin") {
    throw new HTTPException(403, { message: "Only admins may do this" });
  }
  await next();
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery protection for the JSON API. A changing request
 * must come from the admin origin (when the browser says where it comes
 * from) and carry JSON, which another site cannot send without a CORS
 * preflight that this server never grants. Uploads are the exception: they
 * must name the admin origin.
 */
export function originCheck({ config }: Deps) {
  return createMiddleware(async (c, next) => {
    if (!SAFE_METHODS.has(c.req.method)) {
      const origin = c.req.header("origin");
      if (origin && origin !== config.adminOrigin) {
        throw new HTTPException(403, { message: "Cross-origin request refused" });
      }
      // Browsers always label a body; forms and text/plain are what a
      // foreign site could send without a preflight. File uploads need
      // multipart, so it is accepted only with our own origin attached, which
      // browsers send with every POST.
      const type = c.req.header("content-type");
      const upload = type?.startsWith("multipart/form-data") && origin === config.adminOrigin;
      if (type !== undefined && !type.startsWith("application/json") && !upload) {
        throw new HTTPException(415, { message: "Send JSON" });
      }
    }
    await next();
  });
}
