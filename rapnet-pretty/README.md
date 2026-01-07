# RapNet Pretty Output (Cloudflare Pages + D1)

## Where to put your logo
Put your logo at: `public/company-logo.png` (PNG format) — the filename must be exactly `company-logo.png`.

## Local dev
```bash
npm install
npm run dev
```

## Deploy (Cloudflare Pages)
- Connect this GitHub repo to Cloudflare Pages
- Build command: `npm run build`
- Build output directory: `dist`
- Add a D1 binding named `DB` to your Pages project
- Create a D1 database and run the migration in `migrations/0001_init.sql`
