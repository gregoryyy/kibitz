# Node 24 official multi-platform manifest; upgrades require a reviewed digest change.
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base

FROM base AS build
WORKDIR /app/site
COPY site/package.json site/package-lock.json ./
RUN npm ci --ignore-scripts
COPY LICENSE THIRD_PARTY_NOTICES.md /app/
COPY site/src ./src
COPY site/server ./server
COPY site/scripts ./scripts
COPY site/data ./data
RUN npm run build
RUN node --input-type=module -e "import { writeImageDeployment } from './server/deployment.mjs'; writeImageDeployment(process.cwd());"
RUN mkdir /runtime-data && chown 1000:1000 /runtime-data && chmod 700 /runtime-data

FROM base AS production-dependencies
ENV NODE_ENV=production
WORKDIR /app/site
COPY site/package.json site/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Runtime needs Node and shared libraries, without build-stage npm, shells or OS tools.
FROM gcr.io/distroless/nodejs24-debian13:nonroot@sha256:cb606325b7ec4af55462cb0b424a53b452a5b4a894ffe841fcf1048d216fb9f8 AS runtime
ARG VCS_REF=development
LABEL org.opencontainers.image.title="Kibitz" \
      org.opencontainers.image.description="Local single-user neurosymbolic chess coach" \
      org.opencontainers.image.source="https://github.com/gregoryyy/kibitz" \
      org.opencontainers.image.licenses="GPL-3.0-or-later" \
      org.opencontainers.image.revision=$VCS_REF
ENV NODE_ENV=production AI_PROVIDER=mock KIBITZ_HEALTH_HTTPS=1
ENV PATH=/nodejs/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
WORKDIR /app/site
COPY --from=production-dependencies /app/site/node_modules ./node_modules
COPY --from=production-dependencies /app/site/package.json /app/site/package-lock.json ./
COPY --from=build /app/site/dist ./dist
# Shared pure browser modules are also imported by the server, outside the public tree.
COPY --from=build /app/site/src ./src
COPY --from=build /app/site/server ./server
COPY --from=build /app/site/.kibitz-image.json ./
COPY --from=build /app/site/scripts/serve.mjs /app/site/scripts/native-runtime.mjs /app/site/scripts/native-sandbox.mjs /app/site/scripts/image-inventory.mjs /app/site/scripts/healthcheck.mjs ./scripts/
COPY --from=build /app/LICENSE /app/THIRD_PARTY_NOTICES.md /app/
COPY --from=build --chown=1000:1000 --chmod=0700 /runtime-data /data
USER 1000:1000
EXPOSE 8765
VOLUME ["/data"]
# Static-only health check: no cookie, inference, provider credential or usage charge.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "scripts/healthcheck.mjs"]
ENTRYPOINT ["/nodejs/bin/node"]
CMD ["scripts/serve.mjs", "dist", "--api", "--operator", "/tls/operator.json", "--permissions", "/tls/permissions.json", "--sessions", "/data/sessions.sqlite", "--tls-key", "/tls/key.pem", "--tls-cert", "/tls/cert.pem", "--env=", "--host", "0.0.0.0", "--port", "8765", "--index", "_test.html", "--usage", "/data/usage.sqlite", "--library", "/data/library.sqlite"]
