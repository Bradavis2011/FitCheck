FROM node:22-slim

# Prisma requires OpenSSL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --include=dev

# Copy source and build
COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000

RUN chmod +x start.sh
CMD ["./start.sh"]
