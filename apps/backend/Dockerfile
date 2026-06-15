FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g turbo

FROM base AS builder
COPY package.json turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/
COPY packages/events/package.json ./packages/events/
COPY packages/contracts/package.json ./packages/contracts/
RUN npm install --workspaces --if-present
COPY apps/backend ./apps/backend
COPY packages/types ./packages/types
COPY packages/events ./packages/events
COPY packages/contracts ./packages/contracts
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=packages/events
RUN npm run build --workspace=packages/contracts
RUN npx prisma generate --schema=apps/backend/prisma/schema
RUN npm run build --workspace=apps/backend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl curl
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/events/dist ./packages/events/dist
COPY --from=builder /app/packages/events/package.json ./packages/events/package.json
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
RUN npx prisma generate --schema=prisma/schema
EXPOSE 4000
CMD ["node", "dist/src/main"]
