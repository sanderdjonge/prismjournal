FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json* ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Reinstall to get correct platform binaries
RUN npm ci

COPY . .

# Generate Prisma client
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
# Install openssl for Prisma and postgresql-client for pg_dump (backup functionality)
RUN apk add --no-cache openssl postgresql-client \
    chromium nss freetype harfbuzz ca-certificates ttf-freefont
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Tell Playwright to use the Alpine system Chromium instead of downloading its own
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install Prisma CLI for migrations at startup
RUN npm install -g prisma@6

COPY --from=builder /app/public ./public

# Prisma schema + migrations for runtime migrate deploy
COPY --from=builder /app/prisma ./prisma

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create storage directory for screenshots
RUN mkdir -p /app/storage/screenshots && chown -R nextjs:nodejs /app/storage

# ECharts is loaded via readFileSync (not a webpack import), so Next.js standalone
# does not auto-include it. Copy it explicitly so chart rendering works at runtime.
RUN mkdir -p /app/node_modules/echarts/dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/echarts/dist/echarts.min.js /app/node_modules/echarts/dist/echarts.min.js

# Startup script that runs migrations then starts the app
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000

ENTRYPOINT ["./docker-entrypoint.sh"]
