export interface Env {
  DB: D1Database;
}

function makeSlug(len = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

function json(res: unknown, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  // Basic validation
  if (!body?.preparer?.email || !Array.isArray(body?.columns) || !Array.isArray(body?.rows)) {
    return new Response("Missing required fields", { status: 400 });
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  // Try a few slugs in case of collision
  let slug = "";
  for (let i = 0; i < 5; i++) {
    const candidate = makeSlug(8);
    const exists = await env.DB
      .prepare("SELECT slug FROM rapnet_outputs WHERE slug = ?1")
      .bind(candidate)
      .first();
    if (!exists) { slug = candidate; break; }
  }
  if (!slug) return new Response("Failed to create unique slug", { status: 500 });

  const payload = JSON.stringify({ ...body, createdAt });

  await env.DB
    .prepare("INSERT INTO rapnet_outputs (id, slug, created_at, payload) VALUES (?1, ?2, ?3, ?4)")
    .bind(id, slug, createdAt, payload)
    .run();

  return json({ slug });
}
