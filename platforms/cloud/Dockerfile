# syntax=docker/dockerfile:1

# Hyperbook Cloud.
#
# Build from the repository root, so the pnpm workspace and its lockfile are in
# scope — that lockfile is what makes the dependency versions reproducible:
#
#   docker build -f platforms/cloud/Dockerfile -t hyperbook-cloud .
#
# better-sqlite3 is a native module, so the build stage carries a toolchain and
# the runtime stage does not.

FROM node:22-bookworm-slim AS build

RUN corepack enable
WORKDIR /repo

# Only needed when better-sqlite3 has no prebuilt binary for the target
# platform. Left behind in this stage either way.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Manifests first, so editing source does not invalidate the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY platforms/cloud/package.json platforms/cloud/

# --ignore-scripts because the workspace root's prepare hook runs husky, which
# wants a git checkout that is not in the build context.
RUN pnpm install --filter @hyperbook/cloud --prod --frozen-lockfile --ignore-scripts

# Which means the native module has not been built yet. This has to run in the
# workspace, where the lockfile and the store layout are.
RUN pnpm rebuild --filter @hyperbook/cloud

COPY platforms/cloud/ platforms/cloud/

# Fail the build, rather than the first request, if the native module is broken.
RUN cd platforms/cloud \
  && node -e "new (require('better-sqlite3'))(':memory:').exec('select 1')"


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/data/database.sqlite

# tini forwards signals and reaps zombies, so `docker stop` lets the app close
# sqlite cleanly instead of killing it outright.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

# pnpm links dependencies with paths relative to the workspace root, so the
# tree has to land at the same path it was installed at. Copying it to /app
# would leave every symlink dangling.
COPY --from=build --chown=node:node /repo/node_modules /repo/node_modules
COPY --from=build --chown=node:node /repo/platforms/cloud /repo/platforms/cloud

WORKDIR /repo/platforms/cloud

# The database lives on a volume. Declared so that even `docker run` with no
# -v keeps it in a managed volume rather than the container's writable layer,
# where the next image update would destroy it.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "bin/www"]
