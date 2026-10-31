import type { Config } from "./config";
import type { Db } from "./db/client";
import type { Dns } from "./dns";
import type { UrlFetcher } from "./https";
import type { BuildQueue } from "./hosting/builds";
import type { Renderers } from "./hosting/renders";
import type { Mailer } from "./mail";

/** Everything request handlers need, passed in so tests can swap parts. */
export type Deps = {
  config: Config;
  db: Db;
  mailer: Mailer;
  builds: BuildQueue;
  renders: Renderers;
  dns: Dns;
  fetchUrl: UrlFetcher;
};
