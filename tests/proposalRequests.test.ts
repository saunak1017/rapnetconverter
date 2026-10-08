import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildTemplateVariables, submitProposalRequest, TEMPLATE_ID } from "../server/proposalRequests";
import { getRequestColumns } from "../src/lib/proposalRequests";

const slug = "ABCD2345";
const proposal = {
  preparedFor: "Customer & Company",
  columns: [{ key: "Style No.", label: "Reference" }],
  rows: [
    { "Style No.": "SG<1>", "$/ct": "2500", Total: "$10,545 - $11,995" },
    { "Style No.": "SG2", "$/ct": "3200", Total: "4800" },
  ],
};
const requestBody = () => ({
  requestId: crypto.randomUUID(),
  selections: [
    { rowIndex: 0, type: "memo", comments: "First stone" },
    { rowIndex: 1, type: "hold", comments: "Until Friday" },
  ],
  generalNotes: "Please confirm availability.",
});

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  for (const migration of ["0001_init.sql", "0002_media_chunks.sql", "0003_proposal_requests.sql"]) {
    sqlite.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
  }
  sqlite.prepare("INSERT INTO rapnet_outputs VALUES (?, ?, ?, ?)")
    .run("output-1", slug, new Date().toISOString(), JSON.stringify(proposal));
  const db = {
    prepare(sql: string) {
      let bindings: any[] = [];
      return {
        bind(...values: any[]) { bindings = values; return this; },
        async first() { return sqlite.prepare(sql).get(...bindings) ?? null; },
        async run() { return sqlite.prepare(sql).run(...bindings); },
      };
    },
  } as unknown as D1Database;
  const env = { DB: db, RESEND_API_KEY: "test-key" };
  const sent: { url: string; options: RequestInit; body: any }[] = [];
  const send = (async (url, options) => {
    sent.push({ url: String(url), options: options!, body: JSON.parse(String(options?.body)) });
    return Response.json({ id: "email-1" });
  }) as typeof fetch;
  const request = (body: unknown, headers: Record<string, string> = {}) => new Request(`https://proposal.example/api/outputs/${slug}/requests`, {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  });
  return { sqlite, env, sent, send, request };
}

test("hidden and renamed columns retain original style and price keys", () => {
  assert.deepEqual(getRequestColumns(proposal.columns, proposal.rows), {
    styleNumber: "Style No.", perCarat: "$/ct", total: "Total",
  });
});

test("HTML table includes separate stone rows, preserves ranges, and escapes comments", () => {
  const body = requestBody();
  body.selections[0].comments = '<img src=x onerror="alert(1)"> & note';
  const variables = buildTemplateVariables(proposal, body as any, "https://proposal.example/r/ABCD2345");
  assert.equal(variables.CUSTOMER_NAME, proposal.preparedFor);
  assert.equal(variables.PROPOSAL_URL, "https://proposal.example/r/ABCD2345");
  assert.equal((variables.STONES_TABLE.match(/<tr>/g) ?? []).length, 3);
  assert.match(variables.STONES_TABLE, /SG&lt;1&gt;/);
  assert.match(variables.STONES_TABLE, /\$2500\.00/);
  assert.match(variables.STONES_TABLE, /\$10,545 - \$11,995/);
  assert.match(variables.STONES_TABLE, />Memo</);
  assert.match(variables.STONES_TABLE, />Hold</);
  assert.match(variables.STONES_TABLE, /&lt;img/);
  assert.doesNotMatch(variables.STONES_TABLE, /<img/);
});

test("sends the configured template, recipients and Reply-To using persisted proposal data", async () => {
  const f = fixture();
  const body = { ...requestBody(), preparedFor: "Forged name", rows: [{ Total: "0" }] };
  const response = await submitProposalRequest(f.request(body), f.env, slug, f.send);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(f.sent.length, 1);
  const email = f.sent[0];
  assert.equal(email.url, "https://api.resend.com/emails");
  assert.equal(email.body.template.id, TEMPLATE_ID);
  assert.equal(email.body.from, "Saunak <saunak@shivanigems.com>");
  assert.equal(email.body.reply_to, "saunak@shivanigems.com");
  assert.deepEqual(email.body.to, ["saunak@shivanigems.com", "atit@shivanigems.com"]);
  assert.equal(email.body.template.variables.CUSTOMER_NAME, proposal.preparedFor);
  assert.match(email.body.template.variables.STONES_TABLE, /\$4800\.00/);
  assert.equal(new Headers(email.options.headers).get("idempotency-key"), `proposal-request/${slug}/${body.requestId}`);
});

test("repeating a successful request returns success without sending another email", async () => {
  const f = fixture();
  const body = requestBody();
  assert.equal((await submitProposalRequest(f.request(body), f.env, slug, f.send)).status, 200);
  assert.equal((await submitProposalRequest(f.request(body), f.env, slug, f.send)).status, 200);
  assert.equal(f.sent.length, 1);
});

test("same ID with changed selections is rejected", async () => {
  const f = fixture();
  const body = requestBody();
  await submitProposalRequest(f.request(body), f.env, slug, f.send);
  body.selections[0].type = "hold";
  assert.equal((await submitProposalRequest(f.request(body), f.env, slug, f.send)).status, 409);
  assert.equal(f.sent.length, 1);
});

test("provider failure does not report success and retry retains the idempotency key", async () => {
  const f = fixture();
  const body = requestBody();
  const fail = (async () => Response.json({ message: "Rejected" }, { status: 403 })) as typeof fetch;
  assert.equal((await submitProposalRequest(f.request(body), f.env, slug, fail)).status, 502);
  assert.equal(f.sqlite.prepare("SELECT email_id FROM rapnet_proposal_requests").get()?.email_id, null);
  assert.equal((await submitProposalRequest(f.request(body), f.env, slug, f.send)).status, 200);
  assert.equal(new Headers(f.sent[0].options.headers).get("idempotency-key"), `proposal-request/${slug}/${body.requestId}`);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM rapnet_proposal_requests").get()?.count, 1);
});

test("an ambiguous request older than the provider idempotency window is not resent", async () => {
  const f = fixture();
  const body = requestBody();
  const fail = (async () => { throw new Error("timeout"); }) as typeof fetch;
  await submitProposalRequest(f.request(body), f.env, slug, fail);
  f.sqlite.prepare("UPDATE rapnet_proposal_requests SET created_at = ?").run(Date.now() - 24 * 60 * 60 * 1000);
  assert.equal((await submitProposalRequest(f.request(body), f.env, slug, f.send)).status, 409);
  assert.equal(f.sent.length, 0);
});

test("missing key gives an actionable failure and never attempts delivery", async () => {
  const f = fixture();
  assert.equal((await submitProposalRequest(f.request(requestBody()), { DB: f.env.DB }, slug, f.send)).status, 503);
  assert.equal(f.sent.length, 0);
});

test("rejects invalid, duplicate, out-of-range and excessive selections", async () => {
  const f = fixture();
  const body = requestBody();
  const invalid = [
    { ...body, selections: [] },
    { ...body, selections: [{ rowIndex: -1, type: "memo", comments: "" }] },
    { ...body, selections: [{ rowIndex: 0.5, type: "memo", comments: "" }] },
    { ...body, selections: [{ rowIndex: 9, type: "memo", comments: "" }] },
    { ...body, selections: [{ rowIndex: 0, type: "purchase", comments: "" }] },
    { ...body, selections: [body.selections[0], body.selections[0]] },
    { ...body, generalNotes: "x".repeat(4001) },
    { ...body, selections: [{ rowIndex: 0, type: "memo", comments: "x".repeat(2001) }] },
    { ...body, selections: Array.from({ length: 101 }, (_, rowIndex) => ({ rowIndex, type: "memo", comments: "" })) },
    { ...body, requestId: "not-a-uuid" },
  ];
  for (const value of invalid) assert.equal((await submitProposalRequest(f.request(value), f.env, slug, f.send)).status, 400);
  assert.equal(f.sent.length, 0);
});

test("rejects malformed JSON, unexpected content type and cross-origin requests", async () => {
  const f = fixture();
  const malformed = new Request(`https://proposal.example/api/outputs/${slug}/requests`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{",
  });
  assert.equal((await submitProposalRequest(malformed, f.env, slug, f.send)).status, 400);
  assert.equal((await submitProposalRequest(f.request(requestBody(), { "content-type": "text/plain" }), f.env, slug, f.send)).status, 415);
  assert.equal((await submitProposalRequest(f.request(requestBody(), { origin: "https://other.example" }), f.env, slug, f.send)).status, 403);
  assert.equal(f.sent.length, 0);
});

test("unknown proposals return 404 without sending", async () => {
  const f = fixture();
  assert.equal((await submitProposalRequest(f.request(requestBody()), f.env, "MISSING1", f.send)).status, 404);
  assert.equal(f.sent.length, 0);
});

test("rate limit bounds new requests but still allows retries of accepted requests", async () => {
  const f = fixture();
  const first = requestBody();
  for (let index = 0; index < 10; index++) {
    const body = index === 0 ? first : requestBody();
    assert.equal((await submitProposalRequest(f.request(body), f.env, slug, f.send)).status, 200);
  }
  assert.equal((await submitProposalRequest(f.request(requestBody()), f.env, slug, f.send)).status, 429);
  assert.equal((await submitProposalRequest(f.request(first), f.env, slug, f.send)).status, 200);
  assert.equal(f.sent.length, 10);
});
