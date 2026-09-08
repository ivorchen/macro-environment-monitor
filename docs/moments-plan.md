# Daily Moments package

Prepare only. Never control, upload to, or post through WeChat in this job.

## Verified native capability

On September 5, 2026, Codex opened the logged-in Mac WeChat Moments window,
clicked its Post entry point, and reached the native image picker. The picker
was canceled without selecting files. Nine-photo selection and the final
composer are unverified. No WeChat API credential is needed for this UI path.

## Workflow

After the existing 08:30 America/Toronto ingestion job, capture a frozen set of public dashboard API responses,
replay those responses into an isolated browser, and capture the four dashboard
tabs. Render nine square cartoon-style editorial cards, a grid preview, caption,
source data, and a local review page. Retain date-specific output and use a lock
to prevent concurrent runs. A complete package is reused on repeat runs.

Missing endpoints and old reports are labeled and recorded in the manifest;
packages needing review are never described as approved for publication.
Chinese text is typeset, not generated inside raster artwork. Artwork is static
vector illustration, not actual animation. Keep output private and ignored by git.

## Operation

Run `pnpm moments:prepare` with the production application running at 127.0.0.1:3000.
Before capture, run `docker compose --env-file .env.local up -d redis`, verify
`docker compose --env-file .env.local exec -T redis redis-cli ping` returns PONG,
and confirm the app plus insight/news endpoints respond successfully. The
generator now aborts if either required content endpoint fails.
Set MOMENTS_APP_URL for another origin, MOMENTS_OUTPUT_DIR for a private output
directory, or MOMENTS_BROWSER_CHANNEL to select an installed Chromium channel.
The default browser channel is chrome. No AI or WeChat API key is required.

The daily task requires the local app and Mac to be available. It prepares files
only; publication needs a separate explicit request. A future native draft test
must verify ordering, nine-image support, and cancellation before any posting
integration is considered.

The existing heartbeat now runs daily: weekday ingestion remains intact, and
weekends skip ingestion and prepare from the latest available observations.
Use `pnpm moments:prepare --refresh` to correct a same-day package; the previous
output is archived, not deleted. Failed builds remain in `.partial` directories
for diagnosis. An interrupted process may leave a date lock; verify that no job
is running before manually removing that specific lock.
