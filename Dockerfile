# syntax=docker/dockerfile:1.7

# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
# alpine sometimes needs libc6-compat for native modules
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- runner ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

# Run as non-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone output from `output: "standalone"` in next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/config').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# The standalone server respects PORT / HOSTNAME env vars
CMD ["node", "server.js"]
