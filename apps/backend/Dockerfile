FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g turbo

FROM base AS builder
COPY package.json turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/
RUN npm install --workspaces --if-present
COPY apps/backend ./apps/backend
COPY packages/types ./packages/types
RUN npm run build --workspace=apps/backend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/prisma ./prisma
RUN npx prisma generate
EXPOSE 4000
CMD ["node", "dist/main"]
