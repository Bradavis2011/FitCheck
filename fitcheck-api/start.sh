#!/bin/sh
set -e
echo "[start] Running prisma migrate deploy..."
# Timeout after 60s — prevents hanging forever if DB is temporarily unreachable
if ! timeout 60 npx prisma migrate deploy; then
  echo "[start] WARNING: prisma migrate deploy failed or timed out — starting server anyway"
fi
echo "[start] Starting server..."
exec node dist/server.js
