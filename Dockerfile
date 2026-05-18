# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN apk add --no-cache curl

COPY package.json package-lock.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --chown=nodejs:nodejs src ./src

USER nodejs
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1

CMD ["node", "src/server.js"]
