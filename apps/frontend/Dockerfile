FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json turbo.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/types/package.json ./packages/types/
RUN npm install --workspaces --if-present
COPY apps/frontend ./apps/frontend
COPY packages/types ./packages/types
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=apps/frontend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public
EXPOSE 3000
CMD ["node", "apps/frontend/server.js"]
