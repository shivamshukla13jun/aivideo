# syntax=docker/dockerfile:1
# ALL-IN-ONE image: Next.js app + Suwayomi-Server in a single web service.
#
#   - Next.js standalone server listens on 0.0.0.0:$PORT (default 3000)
#   - Suwayomi-Server runs inside the same container on 4567
#   - /suwayomi/* requests are proxied to it via a Next.js rewrite,
#     so BOTH apps share the same domain/port
#
# Build:  docker build -t aivideo-app .
# Run:    docker run -p 3000:3000 --env-file .env \
#           -v suwayomi_data:/home/suwayomi/.local/share/Tachidesk aivideo-app
# Or:     docker compose up -d --build

#############################
# Stage 1: install dependencies
#############################
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

#############################
# Stage 2: build Next.js standalone output
#############################
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Internal Suwayomi base used by the /suwayomi/* rewrite (baked at build time).
# The embedded server runs with webUISubpath=/suwayomi, so the whole Suwayomi
# API+WebUI lives under http://127.0.0.1:4567/suwayomi inside the container.
ARG SUWAYOMI_INTERNAL_URL=http://127.0.0.1:4567/suwayomi
ENV SUWAYOMI_URL=$SUWAYOMI_INTERNAL_URL
# Browser-facing base for Suwayomi asset URLs (same-origin proxy path)
ARG NEXT_PUBLIC_SUWAYOMI_URL=/suwayomi
ENV NEXT_PUBLIC_SUWAYOMI_URL=$NEXT_PUBLIC_SUWAYOMI_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

#############################
# Stage 3: Suwayomi-Server jar + matching JRE from the official image
#############################
FROM ghcr.io/suwayomi/suwayomi-server:stable AS suwayomi

#############################
# Stage 4: runtime (node + jre + both apps)
#############################
FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    SUWAYOMI_URL=http://127.0.0.1:4567/suwayomi \
    NEXT_PUBLIC_SUWAYOMI_URL=/suwayomi \
    JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH

WORKDIR /app

# tini = init/signal handling; fontconfig+freetype keep the headless JRE happy
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini fontconfig libfreetype6 \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /home/suwayomi/.local/share/Tachidesk

# Java runtime + Suwayomi jar copied from the official image (guaranteed to match)
COPY --from=suwayomi /opt/java/openjdk /opt/java/openjdk
COPY --from=suwayomi /home/suwayomi/startup /opt/suwayomi

# Next.js standalone server
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/eng.traineddata ./eng.traineddata

COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

EXPOSE 3000
# Suwayomi data (library, downloads, extensions) — mount a volume/disk here
VOLUME ["/home/suwayomi/.local/share/Tachidesk"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/start.sh"]
