#!/bin/sh
echo "[start] Running prisma migrate deploy..."
npx prisma migrate deploy
echo "[start] migrate exit code: $?"

echo "[start] Starting server..."
exec node dist/server.js
