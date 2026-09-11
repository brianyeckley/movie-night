#!/bin/sh
set -e

# Path to the sqlite database
DB_FILE="/app/data/dev.db"

echo "Checking database status at $DB_FILE..."

# If database does not exist, we'll mark it for seeding
SEED_REQUIRED=false
if [ ! -f "$DB_FILE" ] || [ ! -s "$DB_FILE" ]; then
  echo "Database file does not exist or is empty. Seeding will run after migrations."
  SEED_REQUIRED=true
fi

# Run migrations
echo "Applying database migrations..."
npx prisma migrate deploy

# Seed if required
if [ "$SEED_REQUIRED" = true ]; then
  echo "Seeding the database..."
  npx tsx prisma/seed.ts
else
  echo "Database already exists. Skipping seeding."
fi

# Link any legacy public/bg images to their catalog movie, if not already
# done. Safe to run on every boot: it skips movies that already have
# background images, so this only ever does real work once per movie.
echo "Linking legacy background images to catalog movies..."
npx tsx prisma/backfill-bg-images.ts

# Start the application
echo "Starting Next.js application..."
exec node server.js
