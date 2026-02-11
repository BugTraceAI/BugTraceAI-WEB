#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting BugTraceAI-WEB Backend..."
exec node dist/index.js
