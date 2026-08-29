export interface Env {
  DB: D1Database;
}

const MEDIA_CHUNK_SIZE = 400_000;

type MediaAttachment = {
  fileName: string;
  mediaType: "image" | "video";
  dataUrl: string;
};

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

  const mediaByRowIndex = (body.mediaByRowIndex ?? {}) as Record<string, MediaAttachment>;
  const mediaManifest = Object.fromEntries(
    Object.entries(mediaByRowIndex).map(([rowIndex, media]) => [rowIndex, {
      fileName: media.fileName,
      mediaType: media.mediaType,
    }])
  );
  const payload = JSON.stringify({
    ...body,
    mediaByRowIndex: mediaManifest,
    createdAt,
  });

  try {
    await env.DB
      .prepare("INSERT INTO rapnet_outputs (id, slug, created_at, payload) VALUES (?1, ?2, ?3, ?4)")
      .bind(id, slug, createdAt, payload)
      .run();

    for (const [rowIndex, media] of Object.entries(mediaByRowIndex)) {
      if (!media?.dataUrl) continue;
      for (let offset = 0, chunkIndex = 0; offset < media.dataUrl.length; offset += MEDIA_CHUNK_SIZE, chunkIndex += 1) {
        await env.DB
          .prepare(`INSERT INTO rapnet_output_media_chunks
            (output_id, row_index, chunk_index, data) VALUES (?1, ?2, ?3, ?4)`)
          .bind(id, rowIndex, chunkIndex, media.dataUrl.slice(offset, offset + MEDIA_CHUNK_SIZE))
          .run();
      }
    }
  } catch (error) {
    await env.DB.prepare("DELETE FROM rapnet_output_media_chunks WHERE output_id = ?1").bind(id).run().catch(() => undefined);
    await env.DB.prepare("DELETE FROM rapnet_outputs WHERE id = ?1").bind(id).run().catch(() => undefined);
    console.error("Failed to save output", error);
    return new Response(
      "Failed to save the output. Make sure database migration 0002_media_chunks.sql has been applied.",
      { status: 500 }
    );
  }

  return json({ slug });
}
