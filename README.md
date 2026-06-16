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

## Daily Voting Reminders (Discord)

A background check is available at `/api/cron/remind-votes` to see who hasn't voted in the current active round and send reminders to your Discord webhook.

### 1. Setup Environment Variables
Configure the optional security key in your `.env` file to prevent unauthorized triggering of the webhook:
```env
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
NEXT_PUBLIC_APP_URL="https://your-app-domain.com"
CRON_SECRET="your-secure-cron-secret-token"
```

### 2. Triggering via Crontab (Private VPS / Local VM)
To schedule this check daily at 12:00 PM (noon) server time, add a local `crontab` entry on your VM:
1. Open the crontab configuration:
   ```bash
   crontab -e
   ```
2. Add a cron schedule task, replacing your actual domain and secret token:
   ```text
   0 12 * * * curl -s "https://your-app-domain.com/api/cron/remind-votes?secret=your-secure-cron-secret-token" > /dev/null
   ```

### 3. Triggering via Vercel Cron
If hosted on Vercel, you can declare the cron check in a `vercel.json` file in the root of the project:
```json
{
  "crons": [
    {
      "path": "/api/cron/remind-votes?secret=your-secure-cron-secret-token",
      "schedule": "0 17 * * *"
    }
  ]
}
```
*(Note: Vercel Cron schedules run in UTC time. For example, `0 17 * * *` runs daily at 17:00 UTC, which corresponds to 12:00 PM EST / 11:00 AM CST).*
