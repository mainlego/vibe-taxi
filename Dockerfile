# Base image
FROM node:20-alpine AS base
RUN npm install -g pnpm

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/client/package.json ./apps/client/
COPY apps/driver/package.json ./apps/driver/
COPY apps/admin/package.json ./apps/admin/
COPY packages/database/package.json ./packages/database/
RUN pnpm install --frozen-lockfile

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN pnpm --filter @vibe-taxi/database db:generate

# Build all apps
RUN pnpm build

# API Runner
FROM base AS api
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/package.json ./

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]

# Client Runner
FROM base AS client
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/client/.next/standalone ./
COPY --from=builder /app/apps/client/.next/static ./apps/client/.next/static
COPY --from=builder /app/apps/client/public ./apps/client/public

EXPOSE 3000
CMD ["node", "apps/client/server.js"]

# Driver Runner
FROM base AS driver
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/driver/.next/standalone ./
COPY --from=builder /app/apps/driver/.next/static ./apps/driver/.next/static
COPY --from=builder /app/apps/driver/public ./apps/driver/public

EXPOSE 3002
CMD ["node", "apps/driver/server.js"]

# Admin Runner
FROM base AS admin
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder /app/apps/admin/public ./apps/admin/public

EXPOSE 3003
CMD ["node", "apps/admin/server.js"]
