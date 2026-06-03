# Movie Night

A modern web application to vote on and track weekly movies to watch.

## Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Database**: SQLite (managed via Prisma ORM)
- **Styling**: Vanilla CSS

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
   *(Note: This will automatically generate the Prisma Client via the `postinstall` script.)*

2. Initialize the database and apply migrations:
   ```bash
   npx prisma migrate dev
   ```
   *(Note: This will create your local SQLite database file `dev.db` and automatically seed it with initial data.)*

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## DB Migrations & Backfilling Metadata

If you pull updates that include database schema changes (such as the IMDb scraping metadata and trailer URL changes):

1. **Apply Migrations and Regenerate Prisma Client**:
   ```bash
   npx prisma migrate dev
   ```

2. **Backfill Existing Movies**:
   If you have existing movies in your local database that lack year, director, starring cast, or runtime metadata, run the backfiller script to automatically fetch and save details:
   ```bash
   npx tsx prisma/backfill-metadata.ts
   ```

