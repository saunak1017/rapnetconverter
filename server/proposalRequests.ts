import { getRequestColumns, getStoneSummary } from "../src/lib/proposalRequests";
import type { RequestColumns, RequestType } from "../src/lib/proposalRequests";
import type { ColumnDef, RapRow } from "../src/lib/types";

export interface RequestEnv {
  DB: D1Database;
  RESEND_API_KEY?: string;
}

type Selection = { rowIndex: number; type: RequestType; comments: string };
type RequestBody = { requestId: string; selections: Selection[]; generalNotes: string };
type Proposal = {
  preparedFor?: string;
  columns: ColumnDef[];
  rows: RapRow[];
  requestColumns?: RequestColumns;
};

export const TEMPLATE_ID = "9660a6c0-2521-4da5-b062-fef3c55f5cd3";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]!));
}

function parseBody(value: unknown): RequestBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.requestId !== "string" || !UUID.test(body.requestId) ||
      !Array.isArray(body.selections) || body.selections.length < 1 || body.selections.length > 100 ||
      typeof body.generalNotes !== "string" || body.generalNotes.length > 4000) return null;

  const selections: Selection[] = [];
  const seen = new Set<number>();
  for (const item of body.selections) {
    if (!item || typeof item !== "object" || !Number.isSafeInteger(item.rowIndex) || item.rowIndex < 0 ||
        seen.has(item.rowIndex) || !["memo", "hold"].includes(item.type) ||
        typeof item.comments !== "string" || item.comments.length > 2000) return null;
    seen.add(item.rowIndex);
    selections.push({ rowIndex: item.rowIndex, type: item.type, comments: item.comments.trim() });
  }
  selections.sort((a, b) => a.rowIndex - b.rowIndex);
  return { requestId: body.requestId, selections, generalNotes: body.generalNotes.trim() };
}

export function buildTemplateVariables(proposal: Proposal, body: RequestBody, proposalUrl: string) {
  const columns = proposal.requestColumns ?? getRequestColumns(proposal.columns, proposal.rows);
  const cellStyle = "border:1px solid #d1d5db;padding:10px;text-align:left;vertical-align:top;";
  const headers = ["Stone ID", "$/ct", "Total price", "Request", "Comments"]
    .map((label) => `<th scope="col" style="${cellStyle}background:#f3f4f6;">${label}</th>`).join("");
  const rows = body.selections.map((selection) => {
    const stone = getStoneSummary(proposal.rows[selection.rowIndex], columns);
    const values = [stone.styleNumber, stone.perCarat, stone.total,
      selection.type === "hold" ? "Hold" : "Memo", selection.comments || "None"];
    return `<tr>${values.map((value) => `<td style="${cellStyle}white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(value)}</td>`).join("")}</tr>`;
  }).join("");
  return {
    CUSTOMER_NAME: proposal.preparedFor?.trim() || "Customer name not provided",
    PROPOSAL_URL: proposalUrl,
    STONES_TABLE: `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`,
    GENERAL_NOTES: body.generalNotes || "None",
  };
}

export async function submitProposalRequest(
  request: Request, env: RequestEnv, slug: string, send: typeof fetch = fetch
): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return json({ error: "Please submit your request from the proposal page." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Expected a JSON request." }, 415);
  }
  if (!/^[A-Z0-9]{8}$/.test(slug)) return json({ error: "Proposal not found." }, 404);

  let body: RequestBody | null;
  try {
    const raw = await request.text();
    if (raw.length > 250_000) return json({ error: "Your request is too large." }, 413);
    body = parseBody(JSON.parse(raw));
  } catch {
    return json({ error: "Invalid request. Please select your stones again." }, 400);
  }
  if (!body) return json({ error: "Select 1–100 stones, choose Memo or Hold, and keep comments within the displayed limits." }, 400);

  try {
    const output = await env.DB.prepare("SELECT id, payload FROM rapnet_outputs WHERE slug = ?1")
      .bind(slug).first<{ id: string; payload: string }>();
    if (!output) return json({ error: "Proposal not found." }, 404);
    const proposal = JSON.parse(output.payload) as Proposal;
    if (!Array.isArray(proposal.rows) || !Array.isArray(proposal.columns)) throw new Error("Invalid proposal");
    if (body.selections.some((selection) => selection.rowIndex >= proposal.rows.length)) {
      return json({ error: "One of the selected stones is no longer in this proposal. Please reload the page." }, 400);
    }

    const requestPayload = JSON.stringify({ selections: body.selections, generalNotes: body.generalNotes });
    const findRequest = () => env.DB.prepare(
      "SELECT output_id, request_payload, created_at, email_id FROM rapnet_proposal_requests WHERE request_id = ?1"
    ).bind(body.requestId).first<{ output_id: string; request_payload: string; created_at: number; email_id: string | null }>();
    let existing = await findRequest();
    if (existing && (existing.output_id !== output.id || existing.request_payload !== requestPayload)) {
      return json({ error: "This request changed. Please reopen the summary and submit again." }, 409);
    }
    if (existing?.email_id) return json({ success: true });
    // Resend retains idempotency keys for 24 hours; do not risk resending an older ambiguous request.
    if (existing && existing.created_at < Date.now() - 23 * 60 * 60 * 1000) {
      return json({ error: "This request has expired. Please contact Shivani Gems to confirm its status." }, 409);
    }
    if (!env.RESEND_API_KEY) return json({ error: "Requests are temporarily unavailable. Please contact Shivani Gems directly." }, 503);

    if (!existing) {
      const now = Date.now();
      // Bound public submissions per proposal; retries reuse the same record and do not consume another slot.
      await env.DB.prepare(`INSERT OR IGNORE INTO rapnet_proposal_requests
        (request_id, output_id, request_payload, created_at)
        SELECT ?1, ?2, ?3, ?4 WHERE
        (SELECT COUNT(*) FROM rapnet_proposal_requests WHERE output_id = ?2 AND created_at > ?5) < 10`)
        .bind(body.requestId, output.id, requestPayload, now, now - 10 * 60 * 1000).run();
      existing = await findRequest();
      if (!existing) return json({ error: "Too many requests for this proposal. Please wait 10 minutes before trying again." }, 429);
      if (existing.output_id !== output.id || existing.request_payload !== requestPayload) {
        return json({ error: "This request changed. Please reopen the summary and submit again." }, 409);
      }
    }

    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
        "idempotency-key": `proposal-request/${slug}/${body.requestId}`,
      },
      body: JSON.stringify({
        from: "Saunak <saunak@shivanigems.com>",
        to: ["saunak@shivanigems.com", "atit@shivanigems.com"],
        reply_to: "saunak@shivanigems.com",
        template: { id: TEMPLATE_ID, variables: buildTemplateVariables(proposal, body, `${url.origin}/r/${slug}`) },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Avoid logging provider responses or customer data; no success is shown unless Resend accepts the email.
      console.error("Proposal email was rejected by Resend", response.status);
      return json({ error: "We couldn't send your request. Please try again or contact Shivani Gems directly." }, 502);
    }
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("Missing email ID");
    await env.DB.prepare("UPDATE rapnet_proposal_requests SET email_id = ?1 WHERE request_id = ?2")
      .bind(result.id, body.requestId).run();
    return json({ success: true });
  } catch {
    console.error("Proposal request could not be completed");
    return json({ error: "We couldn't confirm your request. Please try again or contact Shivani Gems directly." }, 502);
  }
}
