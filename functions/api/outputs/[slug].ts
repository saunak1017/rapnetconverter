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
    .prepare("SELECT id, payload FROM rapnet_outputs WHERE slug = ?1")
    .bind(slug)
    .first<{ id: string; payload: string }>();

  if (!row) return new Response("Not found", { status: 404 });

  try {
    const payload = JSON.parse(row.payload);
    const chunks = await env.DB
      .prepare(`SELECT row_index, data FROM rapnet_output_media_chunks
        WHERE output_id = ?1 ORDER BY row_index, chunk_index`)
      .bind(row.id)
      .all<{ row_index: string; data: string }>();

    const dataByRowIndex: Record<string, string> = {};
    for (const chunk of chunks.results) {
      dataByRowIndex[chunk.row_index] = (dataByRowIndex[chunk.row_index] ?? "") + chunk.data;
    }
    for (const [rowIndex, media] of Object.entries(payload.mediaByRowIndex ?? {})) {
      const existingMedia = media as { dataUrl?: string };
      payload.mediaByRowIndex[rowIndex] = {
        ...existingMedia,
        dataUrl: dataByRowIndex[rowIndex] ?? existingMedia.dataUrl ?? "",
      };
    }

    return json(payload);
  } catch {
    return new Response("Corrupt payload", { status: 500 });
  }
}
