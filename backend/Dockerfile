# BugTraceAI-WEB Backend Dockerfile
# Multi-stage build for Express + Prisma

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma (Alpine needs this explicitly)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source files and build
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:20-alpine AS production

# Install OpenSSL for Prisma runtime and Docker CLI for Kali MCP execution
RUN apk add --no-cache openssl wget docker-cli

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy Prisma schema for migrations
COPY prisma ./prisma

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Regenerate Prisma client in production stage (ensures correct binary)
RUN npx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Expose the port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Run migrations then start the server
CMD ["./docker-entrypoint.sh"]
