# Stage 1: Build — install devDeps, generate Prisma client, compile TypeScript
FROM node:22-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --include=dev
COPY . .
RUN npx prisma generate && npm run build

# Stage 2: Production — lean image, no devDeps, no source
FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY start.sh ./
RUN chmod +x start.sh

# Run as non-root for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -f http://localhost:3000/health || exit 1

CMD ["./start.sh"]
