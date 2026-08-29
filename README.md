# RapNet Pretty Output (Cloudflare Pages + D1)

## Where to put your logo
Put your logo at: `public/company-logo.png` (PNG format) — the filename must be exactly `company-logo.png`.

## Local dev
```bash
npm install
npm run dev
```

## Stone images and videos
Upload `.png`, `.jpg`, `.jpeg`, or `.mp4` files along with the RapNet export. The part of each
media filename before its extension must match a Style Number, Stock ID, Lot ID, or Vendor Stock
Number in the spreadsheet. Matching is case-insensitive and supports uppercase file extensions.

Currency ranges entered in a price field (for example, `$10,545 - $11,995`) are preserved as
entered in both the shareable output and downloaded PDF.

## Deploy (Cloudflare Pages)
- Connect this GitHub repo to Cloudflare Pages
- Build command: `npm run build`
- Build output directory: `dist`
- Add a D1 binding named `DB` to your Pages project
- Create a D1 database and run the migration in `migrations/0001_init.sql`
