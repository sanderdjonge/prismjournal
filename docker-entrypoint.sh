#!/bin/sh
set -e

echo "Running Prisma migrations..."
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "Starting PrismJournal..."
export HOSTNAME=0.0.0.0
exec node server.js
