#!/bin/sh
set -e
echo "[start] Running prisma migrate deploy..."
npx prisma migrate deploy
echo "[start] migrate deploy succeeded"

echo "[start] Starting server..."
exec node dist/server.js
