import type { Instance } from "./helpers";

/**
 * A browser on a book's host: same-origin requests (unless told otherwise),
 * JSON bodies, and it keeps the student cookie.
 */
export function bookClient(instance: Instance, host: string, options: { origin?: string | null } = {}) {
  let cookie = "";
  const origin = options.origin === undefined ? `http://${host}` : options.origin;

  async function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const h: Record<string, string> = { host, ...headers };
    if (method !== "GET" && origin) h.origin = origin;
    if (body !== undefined) h["content-type"] = "application/json";
    if (cookie) h.cookie = cookie;
    const res = await instance.app.request(path, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const pair = setCookie.split(";")[0]!;
      cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers, setCookie };
  }

  return {
    get: (path: string, headers?: Record<string, string>) => request("GET", path, undefined, headers),
    post: (path: string, body: unknown = {}, headers?: Record<string, string>) => request("POST", path, body, headers),
    get cookie() {
      return cookie;
    },
  };
}
