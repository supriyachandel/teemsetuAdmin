FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json ./

# Copy apps/web/package.json so npm ci succeeds without missing dependencies
COPY apps/web/package.json ./apps/web/

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install everything (now safe because all workspace dirs exist)
RUN npm ci

# Build shared
RUN npm run build -w @crm/shared

# Build API
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
RUN mkdir -p uploads
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/scripts/fix-roles.js && node dist/server.js"]
