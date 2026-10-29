# Frozen previous packaging recipe (2fe12ab); current app source in both images.
# Node 24 official multi-platform manifest; upgrades require a reviewed digest change.
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base

FROM base AS build
WORKDIR /app/site
COPY site/package.json site/package-lock.json ./
RUN npm ci --ignore-scripts
COPY LICENSE NOTICE /app/
COPY site/src ./src
COPY site/server ./server
COPY site/scripts ./scripts
COPY site/data ./data
RUN npm run build

FROM base AS production-dependencies
ENV NODE_ENV=production
WORKDIR /app/site
COPY site/package.json site/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM base AS runtime
ARG VCS_REF=development
LABEL org.opencontainers.image.title="Kibitz" \
      org.opencontainers.image.description="Local single-user neurosymbolic chess coach" \
      org.opencontainers.image.source="https://github.com/gregoryyy/kibitz" \
      org.opencontainers.image.licenses="GPL-3.0-or-later" \
      org.opencontainers.image.revision=$VCS_REF
ENV NODE_ENV=production AI_PROVIDER=mock
WORKDIR /app/site
COPY --from=production-dependencies /app/site/node_modules ./node_modules
COPY --from=production-dependencies /app/site/package.json /app/site/package-lock.json ./
COPY --from=build /app/site/dist ./dist
# Shared pure browser modules are also imported by the server, outside the public tree.
COPY --from=build /app/site/src ./src
COPY --from=build /app/site/server ./server
COPY --from=build /app/site/scripts/serve.mjs ./scripts/serve.mjs
COPY --from=build /app/LICENSE /app/NOTICE /app/
RUN mkdir /data && chown node:node /data && chmod 700 /data
USER node
EXPOSE 8765
VOLUME ["/data"]
# Static-only health check: no cookie, inference, provider credential or usage charge.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8765/manifest.webmanifest',{signal:AbortSignal.timeout(4000)}).then(async r=>{await r.arrayBuffer();process.exit(r.status===200?0:1)}).catch(()=>process.exit(1))"]
CMD ["node", "scripts/serve.mjs", "dist", "--api", "--env=", "--host", "0.0.0.0", "--port", "8765", "--index", "_test.html", "--usage", "/data/usage.sqlite", "--library", "/data/library.sqlite"]
