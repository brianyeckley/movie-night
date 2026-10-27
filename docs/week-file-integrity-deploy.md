# Deploying the week-file integrity fix

Context for whoever deploys this branch (and for any AI assistant reading it
alongside the diff). It covers one schema change and a handful of behaviour
changes that are visible the moment the new image boots.

## Short version

**There is nothing to run by hand.** `docker-entrypoint.sh` already runs
`npx prisma migrate deploy` on every container boot, before `server.js`
starts, and the Dockerfile copies `prisma/` into the runtime image. So the
normal path — merge to `master`, GitHub Actions pushes the image to GHCR,
Watchtower picks it up within 5 minutes — applies the migration on its own.

Taking a backup first is still worth it (`npm run db:backup`), but the
migration itself is additive and does not rewrite the table.

## The migration

`prisma/migrations/20261027143000_add_week_file_content_hash/`

```sql
ALTER TABLE "WeekFile" ADD COLUMN "contentHash" TEXT;
```

One nullable column holding the SHA-256 of a finished upload. In SQLite,
adding a nullable column with no default is a metadata-only change — it does
not copy the table, so it is effectively instant regardless of row count
(`WeekFile` holds at most one row per week anyway).

Nothing backfills it. Files uploaded before this deploy keep `contentHash =
NULL`, which simply means the UI shows no hash line for them. That is
expected and needs no action.

## Why this change exists

Uploads could finish, be marked complete, and still hold the wrong bytes —
so the corruption only turned up when someone tried to watch the movie.

Two causes, both fixed here:

1. Nothing verified the bytes. Completion was decided by arithmetic
   (`startSize + received`), never by reading the file back.
2. Appending is atomic per write, not per request. When an upload was
   interrupted, the browser gave up on a request the server was still
   writing and retried from an offset it read out of a half-written file —
   so two writes appended at once and interleaved. Replayed against the real
   code, `"AAAAAAAA"` and `"BBBBBBBB"` became `"ABABABABABABABAB"` while
   both callers were told the file was 8 bytes and 16 were on disk.

## What is different once it is live

**Uploads now require HTTPS.** The browser hashes each chunk with
`crypto.subtle`, which browsers only expose in a secure context. Through the
Cloudflare tunnel this is fine. It only bites if someone opens the app over
plain HTTP on a LAN IP — they get a clear error instead of an upload.
`localhost` counts as secure, so local dev is fine.

**An upload in flight across the deploy will fail.** A browser tab loaded
before the deploy is running the old JavaScript, which does not send the
`X-Chunk-SHA256` header the new server requires, so its next chunk gets a
`400`. The fix is a page refresh and starting that upload again. Worth a
heads-up in chat if someone is mid-upload when this ships.

**An already-broken file will now refuse to download.** Downloads compare
the bytes on disk against `WeekFile.size` and return `409` ("This file is
incomplete on the server...") rather than serving a truncated movie that
looks like a successful download. If a bad file is sitting on the drive
right now, this is the deploy where it starts saying so. Delete it from the
panel and upload it again.

**Finished files show a SHA-256.** Recorded just after the last chunk (it
runs after the response — hashing a whole movie takes minutes, far longer
than Cloudflare keeps a request open) and served as the `X-Content-SHA256`
header, so a download can be checked locally:

```bash
shasum -a 256 "the-downloaded-file.mkv"
```

## Checking it worked

```bash
docker compose logs web | grep -iA3 "Applying database migrations"
```

Expect `migrate deploy` to report the new migration applied (or "No pending
migrations" on later boots). To confirm the column directly — the runtime
image is `node:20-slim` with no `sqlite3` CLI, so go through the driver that
is in there:

```bash
docker compose exec web node -e "console.log(require('better-sqlite3')('/app/data/dev.db').prepare('PRAGMA table_info(WeekFile)').all().map(c => c.name).join(', '))"
```

Then the real check: upload a small file to the current week's winner, and
confirm it completes and shows a `SHA-256 …` line under the file name.

## If it needs rolling back

Rolling back to the previous image is safe and needs no database work. The
old code never selects `contentHash`, and the column is nullable so its
inserts still succeed. Leave the column in place; re-deploying forward then
has nothing to do.

There is no down migration, and none is needed — an unused nullable column
costs nothing.

## No other operational changes

- No new environment variables. (`MOVIE_FILES_DIR` and `MOVIE_FILES_HOST_DIR`
  were already there from the upload feature itself.)
- No dependency changes, so no `npm rebuild better-sqlite3` and no Node
  version change — still Node 22 only.
- No change to how files are stored or where they live, and close-out still
  deletes a week's file.

## Running it locally

The repo's `dev.db` may predate the `WeekFile` table entirely, in which case
the upload panel will not work until migrations are applied:

```bash
npx prisma migrate dev
```

`npm run test` covers this feature with 28 tests, including one that replays
the interleaving bug through the real route handler and asserts the stored
file holds one chunk's bytes whole.
