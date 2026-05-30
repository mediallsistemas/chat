FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* turbo.json ./
COPY apps/transcription-svc/package.json ./apps/transcription-svc/
COPY packages/events/package.json ./packages/events/
COPY packages/contracts/package.json ./packages/contracts/

RUN npm install --workspace=transcription-svc --workspace=packages/events --workspace=packages/contracts --include-workspace-root --omit=optional

COPY apps/transcription-svc ./apps/transcription-svc
COPY packages/events ./packages/events
COPY packages/contracts ./packages/contracts

WORKDIR /app
RUN npm run build --workspace=packages/events
RUN npm run build --workspace=packages/contracts

WORKDIR /app/apps/transcription-svc
RUN npm run build

FROM node:20-alpine

WORKDIR /app

# wget is used by the Docker healthcheck (HTTP probe to /health on 4001)
RUN apk add --no-cache wget

# Run as non-root (matches infra rule: containers without root)
RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/transcription-svc/dist ./dist
COPY --from=builder --chown=app:app /app/apps/transcription-svc/package.json ./package.json
COPY --from=builder --chown=app:app /app/packages ./packages

USER app

ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
