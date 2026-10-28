# syntax=docker/dockerfile:1

# Hyperbook Cloud.
#
# Build from the repository root, so the pnpm workspace, its lockfile and the
# shared Hyperbook design tokens are in scope:
#
#   docker build -f platforms/cloud/Dockerfile -t hyperbook-cloud .

FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /repo
# Manifests first, so editing source does not invalidate the dependency layers.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY platforms/cloud/package.json platforms/cloud/


# Everything needed to build: Vite, Tailwind, esbuild.
FROM base AS build
# --ignore-scripts because the workspace root's prepare hook runs husky, which
# wants a git checkout that is not in the build context.
RUN pnpm install --filter @hyperbook/cloud --frozen-lockfile --ignore-scripts
COPY packages/markdown/assets/tokens-light.css packages/markdown/assets/tokens-dark.css packages/markdown/assets/
COPY platforms/cloud/ platforms/cloud/
# The context has no .git; pass --build-arg GIT_COMMIT=$(git rev-parse HEAD)
# to show the commit in the sidebar.
ARG GIT_COMMIT
RUN pnpm --filter @hyperbook/cloud build


# The Hyperbook CLI that builds books, from this same repository, so the
# platform and the books it builds always match.
FROM base AS hyperbook
COPY tsconfig.json tsconfig.base.json ./
COPY scripts/ scripts/
COPY packages/ packages/
COPY platforms/vscode/schemas/ platforms/vscode/schemas/
RUN pnpm install --filter "hyperbook..." --frozen-lockfile --ignore-scripts
# Also packs every element's runtime into packages/hyperbook/.cache, which
# books' offline builds use (copied into the image below).
RUN pnpm --filter "hyperbook..." build


# Only what the server needs at runtime.
FROM base AS prod-deps
# Only needed when better-sqlite3 has no prebuilt binary for the platform.
# Left behind in this stage either way.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN pnpm install --filter @hyperbook/cloud --prod --frozen-lockfile --ignore-scripts
# --ignore-scripts above skipped building the native module; do it now, and
# fail the image build (not the first request) if it is broken.
RUN pnpm rebuild --filter @hyperbook/cloud better-sqlite3 \
  && cd platforms/cloud \
  && node -e "new (require('better-sqlite3'))(':memory:').exec('select 1')"


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/data

# tini forwards signals and reaps zombies, so `docker stop` shuts the server
# down cleanly instead of killing it outright.
# git keeps each book's source; see src/server/hosting/git.ts.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini git \
  && rm -rf /var/lib/apt/lists/*

# Owned by root, so a build (running as node) cannot change the CLI.
COPY --from=hyperbook /repo/packages/hyperbook/package.json /repo/packages/hyperbook/
COPY --from=hyperbook /repo/packages/hyperbook/dist /repo/packages/hyperbook/dist
COPY --from=hyperbook /repo/packages/hyperbook/.cache /repo/packages/hyperbook/.cache

# pnpm links dependencies with paths relative to the workspace root, so the
# tree has to land at the same path it was installed at.
COPY --from=prod-deps --chown=node:node /repo/node_modules /repo/node_modules
COPY --from=prod-deps --chown=node:node /repo/platforms/cloud/node_modules /repo/platforms/cloud/node_modules
COPY --from=build --chown=node:node /repo/platforms/cloud/package.json /repo/platforms/cloud/
COPY --from=build --chown=node:node /repo/platforms/cloud/dist /repo/platforms/cloud/dist
COPY --from=build --chown=node:node /repo/platforms/cloud/drizzle /repo/platforms/cloud/drizzle

WORKDIR /repo/platforms/cloud

# Everything the platform stores lives on this volume. Declared so that even
# `docker run` without -v keeps it out of the container's writable layer,
# where the next image update would destroy it.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server/main.js"]
