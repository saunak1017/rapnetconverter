export interface Env {
  DB: D1Database;
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

export async function onRequestGet({ params, env }: { params: any; env: Env }) {
  const slug = String(params.slug || "").trim();
  if (!slug) return new Response("Missing slug", { status: 400 });

  const row = await env.DB
    .prepare("SELECT payload FROM rapnet_outputs WHERE slug = ?1")
    .bind(slug)
    .first<{ payload: string }>();

  if (!row) return new Response("Not found", { status: 404 });

  try {
    return json(JSON.parse(row.payload));
  } catch {
    return new Response("Corrupt payload", { status: 500 });
  }
}
