import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DraftState, RapRow, ColumnDef } from "../lib/types";

function loadDraft(): DraftState | null {
  const raw = sessionStorage.getItem("draft");
  return raw ? (JSON.parse(raw) as DraftState) : null;
}

function loadHiddenKeys(): Set<string> {
  const raw = sessionStorage.getItem("hiddenKeys");
  return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
}

export function EditPage() {
  const nav = useNavigate();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [rows, setRows] = useState<RapRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [markupBase, setMarkupBase] = useState("");
  const [markupPercent, setMarkupPercent] = useState("");

  useEffect(() => {
    const d = loadDraft();
    if (!d) {
      nav("/", { replace: true });
      return;
    }
    setDraft(d);
    setRows(d.rows);
  }, [nav]);

  const hiddenKeys = useMemo(() => loadHiddenKeys(), []);
  const visibleCols: ColumnDef[] = useMemo(() => {
    if (!draft) return [];
    return draft.columns.filter((c) => !hiddenKeys.has(c.key));
  }, [draft, hiddenKeys]);

  const calculatorResult = useMemo(() => {
    const base = Number.parseFloat(markupBase);
    const pct = Number.parseFloat(markupPercent);
    if (Number.isNaN(base) || Number.isNaN(pct)) return "";
    return (base * (1 + pct / 100)).toFixed(2);
  }, [markupBase, markupPercent]);

  if (!draft) return null;

  function parseNumber(value: unknown): number | null {
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    const normalized = raw.replace(/[$,]/g, "");
    const num = Number.parseFloat(normalized);
    return Number.isNaN(num) ? null : num;
  }

  function formatSize(value: unknown): string {
    const num = parseNumber(value);
    if (num === null) return "";
    return num.toFixed(2);
  }

  async function generateOutput() {
    if (!draft.preparer) {
      alert("Missing preparer.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        preparedFor: draft.preparedFor,
        request: draft.request,
        preparer: draft.preparer,
        columns: visibleCols,
        rows,
      };

      const res = await fetch("/api/outputs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to generate output.");
      }

      const data = await res.json() as { slug: string };
      nav(`/r/${data.slug}`);
    } catch (e: any) {
      alert(e?.message ?? "Failed to generate output.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Edit Table</div>
        <p className="p">
          Make any edits directly in the table. When it looks good, click <b>Generate Output</b> to get a shareable link.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="badge">{rows.length} diamonds</span>
          <span className="badge">{visibleCols.length} columns</span>
          <button className="btn" onClick={() => nav("/configure")}>← Back</button>
          <button className="btn primary" onClick={generateOutput} disabled={busy}>
            {busy ? "Generating…" : "Generate Output Link"}
          </button>
        </div>

        <hr />

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                {visibleCols.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rowIdx) => (
                <tr key={rowIdx}>
                  {visibleCols.map((c) => (
                    <td key={c.key}>
                      <input
                        value={r[c.key] ?? ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          const next = [...rows];
                          const row = { ...next[rowIdx], [c.key]: value };
                          if (c.key === "Total") {
                            row.__totalManual = true;
                          }

                          if (c.key === "$/ct" || c.key === "Size") {
                            const manual = row.__totalManual === true;
                            if (!manual) {
                              const price = parseNumber(c.key === "$/ct" ? value : row["$/ct"]);
                              const size = parseNumber(c.key === "Size" ? value : row["Size"]);
                              if (price !== null && size !== null) {
                                row["Total"] = (price * size).toFixed(2);
                              }
                            }
                          }

                          next[rowIdx] = row;
                          setRows(next);
                        }}
                        onBlur={(e) => {
                          if (c.key !== "Size") return;
                          const formatted = formatSize(e.target.value);
                          const next = [...rows];
                          next[rowIdx] = { ...next[rowIdx], [c.key]: formatted };
                          setRows(next);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          <div style={{
            border: "1px solid rgba(148,163,184,.3)",
            borderRadius: 12,
            padding: 14,
            background: "rgba(15,23,42,.3)"
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Markup Calculator</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <input
                className="input"
                style={{ minWidth: 160 }}
                placeholder="Base value"
                value={markupBase}
                onChange={(e) => setMarkupBase(e.target.value)}
              />
              <input
                className="input"
                style={{ minWidth: 160 }}
                placeholder="Markup %"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
              />
              <div className="badge">
                Result: {calculatorResult ? `$${calculatorResult}` : "—"}
              </div>
            </div>
          </div>

          <div className="small">
            Tip: This is intentionally simple and “Excel-like”. We can add bulk find/replace, row delete, or column formatting next.
          </div>
        </div>
      </div>
    </div>
  );
}
