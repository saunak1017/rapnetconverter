# RapNet Pretty Output (Cloudflare Pages + D1)

## Where to put your logo
Put your logo at: `public/company-logo.png` (PNG format) — the filename must be exactly `company-logo.png`.

## Local dev
```bash
npm install
npm run dev
```

Vite serves the frontend only. For local Pages functions and D1, use Node.js 24
and run the following from the repository root:

```bash
npm install --package-lock=false
npm run build
npx wrangler@4.148.0 d1 execute DB --config wrangler.local.jsonc --local --file migrations/0001_init.sql
npx wrangler@4.148.0 d1 execute DB --config wrangler.local.jsonc --local --file migrations/0002_media_chunks.sql
npx wrangler@4.148.0 d1 execute DB --config wrangler.local.jsonc --local --file migrations/0003_proposal_requests.sql
npx wrangler@4.148.0 pages dev dist --d1 DB=00000000-0000-0000-0000-000000000001 --compatibility-date 2026-10-07
```

The local configuration uses a local-only database ID. Do not use it for remote
database commands or deployment. Migrations are idempotent. Local database state
is stored under `.wrangler/`.

Run the request endpoint tests with `npm test`. They use an in-memory SQLite
database and simulated Resend responses; no emails are sent.

## Customer Memo/Hold requests

Customers can select stones in the first **Memo/Hold** column, click **Submit
request**, and review a popup. Each selected stone defaults to Memo and has a
Memo/Hold choice and optional comments. General notes are optional. Submission
requests fulfillment; it does not automatically reserve inventory.

The server reads the customer name from the proposal's **Prepared For** field
and resolves style number, $/ct, and total price from the saved proposal rows.
New proposals retain the original request-column keys even when display columns
are hidden or renamed. Older proposals use their existing column keys and row
headers. Missing values are shown as **Not provided**, rather than guessed.
Currency ranges are preserved.

Email configuration:

- Resend template: `proposal_submissions`
- Template ID: `9660a6c0-2521-4da5-b062-fef3c55f5cd3`
- Template subject: `Memo/Hold request — {{CUSTOMER_NAME}}`
- Variables: `CUSTOMER_NAME`, `PROPOSAL_URL`, `STONES_TABLE`, `GENERAL_NOTES`
- The template must render `{{{STONES_TABLE}}}` as HTML. The server generates
  one bordered table row per selected stone and escapes all cell values.
- From: `Saunak <saunak@shivanigems.com>`
- Reply-To: `saunak@shivanigems.com`
- To: `saunak@shivanigems.com`, `atit@shivanigems.com`

Publish the template in Resend and verify the `shivanigems.com` sending domain.
Set `RESEND_API_KEY` as a **server-side secret** on the Cloudflare Pages project
(in each Production/Preview environment where requests should work), then
redeploy. Do not name it `VITE_RESEND_API_KEY`; it must never be bundled into the
frontend. For local email sending, place `RESEND_API_KEY` in a local `.dev.vars`
file; that file is ignored by Git. Never commit or paste API keys into source.
Local sending uses the same real recipients, so leave the key unset for UI-only
development or run the simulated tests instead.

Apply `migrations/0003_proposal_requests.sql` to the production D1 database before
deploying this feature. It stores submission IDs to prevent duplicate emails on
retry. Each request supports up to 100 stones, 2,000 characters of comments per
stone, and 4,000 characters of general notes. New submissions are limited to ten
per proposal per ten minutes. Unchanged retries reuse the same submission ID and
Resend idempotency key. Requests whose delivery is ambiguous for more than 23
hours require contacting the team, rather than risking duplicate delivery after
Resend's 24-hour idempotency window.

The success message confirms Resend accepted the email, not that it reached the
recipient's inbox. If the key is missing or delivery fails, customers see an
error and their selections and comments remain available for retry.

## Stone images and videos
Upload `.png`, `.jpg`, `.jpeg`, or `.mp4` files along with the RapNet export. The part of each
media filename before its extension must match a Style Number, Stock ID, Lot ID, or Vendor Stock
Number in the spreadsheet. Matching is case-insensitive and supports uppercase file extensions.

Currency ranges entered in a price field (for example, `$10,545 - $11,995`) are preserved as
entered in both the shareable output and downloaded PDF.

Uploaded media is kept in the browser's IndexedDB while an output is being prepared, rather than
in the much smaller session storage quota.

## Deploy (Cloudflare Pages)
- Connect this GitHub repo to Cloudflare Pages
- Build command: `npm run build`
- Build output directory: `dist`
- Add a D1 binding named `DB` to your Pages project
- Create a D1 database and run the migration in `migrations/0001_init.sql`
- Apply `migrations/0002_media_chunks.sql` to existing databases before deploying media uploads
- Apply `migrations/0003_proposal_requests.sql` before deploying Memo/Hold requests
