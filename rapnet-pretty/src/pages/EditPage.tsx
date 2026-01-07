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

  if (!draft) return null;

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
                          const next = [...rows];
                          next[rowIdx] = { ...next[rowIdx], [c.key]: e.target.value };
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

        <div style={{ marginTop: 12 }} className="small">
          Tip: This is intentionally simple and “Excel-like”. We can add bulk find/replace, row delete, or column formatting next.
        </div>
      </div>
    </div>
  );
}
