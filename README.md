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
Configure the security key in your `.env` file to prevent unauthorized triggering of the
webhook. `CRON_SECRET` is required: with no secret configured the endpoint rejects every
request rather than leaving itself open.
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

### 4. Triggering via Docker Compose (Recommended for Docker/NAS)
If you deploy using `docker-compose.yml`, a dedicated `cron` container is automatically included. This service runs `crond`, maps to your host machine's timezone, and pings the `/api/cron/remind-votes` route internally. No external crontab configuration is necessary. You can customize the run time in your `.env` by setting `CRON_SCHEDULE`.

## Docker Deployment & Auto-Updates (GHCR + Watchtower)

You can run the Next.js application, Watchtower (for automatic updates), and the Cloudflare Tunnel inside Docker containers using the provided `docker-compose.yml` file. This is the recommended approach for production or NAS deployment (e.g. UGREEN, Synology, Unraid), as it offloads Docker image building to GitHub Actions CI/CD and handles SQLite database persistence automatically.

### Automated CI/CD (GitHub Actions)

Whenever code is pushed to `main` or `master`, the GitHub Actions workflow (`.github/workflows/docker-publish.yml`) automatically builds the production Docker image and publishes it to GitHub Container Registry:
- Image: `ghcr.io/brianyeckley/movie-night:latest`

### Automated NAS Updates (Watchtower)

The `docker-compose.yml` includes `containrrr/watchtower`, configured with `DOCKER_API_VERSION=1.40`. Watchtower periodically checks GHCR for new image builds (every 5 minutes by default) and automatically pulls and restarts `movie-night-web` without any manual intervention or SSH access required.

### Deployment Steps

1. **Configure Environment Variables**:
   Create a `.env` file in the root of the project (if you haven't already). Make sure it includes your Cloudflare Tunnel Token and other necessary keys:
   ```env
   # Host directory for persistent SQLite database storage (defaults to ./data if omitted)
   DATA_DIR="./data"

   # Cloudflare Tunnel Configuration
   TUNNEL_TOKEN="your-cloudflare-tunnel-token"

   # Project Settings
   # Required in production - the app refuses to start without it, so that
   # session cookies are never signed with a key committed to the repo.
   # Generate one with: openssl rand -base64 32
   SESSION_SECRET="your-generated-session-secret"
   OMDB_API_KEY="your-omdb-api-key"
   DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
   NEXT_PUBLIC_APP_URL="https://your-app-domain.com"
   CRON_SECRET="your-secure-cron-secret-token"
   GOOGLE_SPREADSHEET_ID="your-google-spreadsheet-id"

   # Optional: Cron Reminder Schedule (defaults to '0 12 * * *' if omitted)
   CRON_SCHEDULE="0 12 * * *"
   ```

2. **Start the Containers**:
   Start the services in detached (background) mode:
   ```bash
   docker compose up -d
   ```
   This will:
   - Pull the pre-built Next.js image from `ghcr.io/brianyeckley/movie-night:latest`.
   - Mount the host data directory (defined by `DATA_DIR` in `.env`, falling back to `./data`) to `/app/data` to persist the SQLite database (`dev.db`).
   - Run database migrations (`prisma migrate deploy`) and database seeding on container startup.
   - Start Watchtower to auto-pull new GHCR builds every 5 minutes.
   - Run the `cloudflare/cloudflared` daemon service using your `TUNNEL_TOKEN`.

3. **Configure Tunnel Routing**:
   Depending on how you created your tunnel in Cloudflare:
   - **CLI-Managed Tunnel (Type: `cloudflared`)**: The `docker-compose.yml` file is pre-configured to pass the `--url http://web:4000` CLI argument to `cloudflared`. Traffic is routed automatically inside the Docker network.
   - **Dashboard-Managed Tunnel (Type: `dashboard`)**: You must configure the public hostname rules via the dashboard:
     - Go to the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
     - Navigate to **Access** -> **Tunnels** and click on your tunnel.
     - Click **Edit** and select the **Public Hostname** tab.
     - Add a public hostname (e.g. `movie-night.yeckley.com`) and configure the Service to point to **HTTP** and URL `http://web:4000`.

4. **Check Logs**:
   To monitor the startup, database migrations, and application status:
   ```bash
   docker compose logs -f web
   ```
   To monitor the Cloudflare Tunnel connection:
   ```bash
   docker compose logs -f tunnel
   ```

4. **Stop the Containers**:
   To tear down the containers:
   ```bash
   docker compose down
   ```

## Local Hosting with Cloudflare Tunnels (Manual Setup)

To host your application at `movie-night.yeckley.com` (or your own custom domain) securely from your home network without opening any ports on your router, you can set up a Cloudflare Tunnel. This automatically handles dynamic home IP changes and HTTPS/SSL certificates.

### Setup Steps

1. **Create a Cloudflare Account**: Sign up for a free account at [cloudflare.com](https://www.cloudflare.com/).
2. **Move DNS to Cloudflare**: 
   - Add your domain (e.g., `yeckley.com`) in Cloudflare.
   - Cloudflare will give you two Nameservers (e.g., `dina.ns.cloudflare.com`).
   - Log into your domain registrar (e.g., GoDaddy), go to DNS management, and change your **Nameservers** from the registrar's defaults to Cloudflare's. (Your registrar remains the same; Cloudflare just handles routing).
3. **Install the Cloudflare Daemon (`cloudflared`)**:
   - On your local server machine, install `cloudflared` using `winget` (Windows):
     ```powershell
     winget install Cloudflare.cloudflared
     ```
     *Or download the installer/package for your specific OS from the Cloudflare website.*
4. **Login & Authenticate**:
   - In your terminal, run:
     ```bash
     cloudflared tunnel login
     ```
   - A browser window will open; select your domain to authorize the machine.
5. **Create the Tunnel**:
   - Run:
     ```bash
     cloudflared tunnel create movie-night
     ```
   - This creates a tunnel file. Note the Tunnel ID.
6. **Route the Subdomain**:
   - Link your subdomain (e.g., `movie-night.yeckley.com`) to your tunnel:
     ```bash
     cloudflared tunnel route dns movie-night movie-night.yeckley.com
     ```
7. **Run the Tunnel**:
   - Tell the tunnel to forward incoming traffic to your running Next.js app (assuming port `3000`):
     ```bash
     cloudflared tunnel run --url http://localhost:3000 movie-night
     ```
   *(You can set this up as a Windows Service or WSL systemd service so it runs automatically in the background).*

## Running Unit Tests

We use [Vitest](https://vitest.dev/) to run unit tests that cover server actions, voting validation, round status transitions, and reminder routes.

To run the unit tests once:
```bash
npm run test
```

To run the tests in interactive watch mode (highly recommended during active development):
```bash
npm run test:watch
```

