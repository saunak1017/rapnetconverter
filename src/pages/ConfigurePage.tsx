import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DraftState, ColumnDef } from "../lib/types";
import { ColumnPicker } from "../components/ColumnPicker";
import { PreparerSelect } from "../components/PreparerSelect";

function loadDraft(): DraftState | null {
  const raw = sessionStorage.getItem("draft");
  return raw ? (JSON.parse(raw) as DraftState) : null;
}

export function ConfigurePage() {
  const nav = useNavigate();
  const [draft, setDraft] = useState<DraftState | null>(null);

  const [hiddenKeys, setHiddenKeysState] = useState<Set<string>>(new Set());

  useEffect(() => {
    const d = loadDraft();
    if (!d) {
      nav("/", { replace: true });
      return;
    }
    setDraft(d);

    const hk = sessionStorage.getItem("hiddenKeys");
    if (hk) setHiddenKeysState(new Set(JSON.parse(hk) as string[]));
  }, [nav]);

  const visibleColumns = useMemo(() => {
    if (!draft) return [];
    return draft.columns.filter((c) => !hiddenKeys.has(c.key));
  }, [draft, hiddenKeys]);

  function setHiddenKeys(next: Set<string>) {
    setHiddenKeysState(next);
    sessionStorage.setItem("hiddenKeys", JSON.stringify(Array.from(next)));
  }

  if (!draft) return null;

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Configure Output</div>
        <p className="p">
          Reorder columns, hide anything you don’t want, and fill the header fields.
        </p>

        <div className="row">
          <div className="col">
            <ColumnPicker
              columns={draft.columns}
              hiddenKeys={hiddenKeys}
              setHiddenKeys={setHiddenKeys}
              setColumns={(cols: ColumnDef[]) => {
                const next = { ...draft, columns: cols };
                setDraft(next);
                sessionStorage.setItem("draft", JSON.stringify(next));
              }}
            />
          </div>

          <div className="col">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div className="small" style={{ marginBottom: 8 }}>Prepared For</div>
                <input
                  className="input"
                  value={draft.preparedFor}
                  onChange={(e) => {
                    const next = { ...draft, preparedFor: e.target.value };
                    setDraft(next);
                    sessionStorage.setItem("draft", JSON.stringify(next));
                  }}
                  placeholder="Client / company name…"
                />
              </div>

              <div>
                <div className="small" style={{ marginBottom: 8 }}>Request</div>
                <textarea
                  value={draft.request}
                  onChange={(e) => {
                    const next = { ...draft, request: e.target.value };
                    setDraft(next);
                    sessionStorage.setItem("draft", JSON.stringify(next));
                  }}
                  placeholder="e.g., 2.00–3.00ct ovals, G/H VS…"
                />
              </div>

              <PreparerSelect
                value={draft.preparer}
                onChange={(p) => {
                  const next = { ...draft, preparer: p };
                  setDraft(next);
                  sessionStorage.setItem("draft", JSON.stringify(next));
                }}
              />

              <div className="badge">
                {draft.rows.length} diamonds • {visibleColumns.length} columns visible
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn" onClick={() => nav("/", { replace: true })}>Start over</button>
                <button
                  className="btn primary"
                  onClick={() => {
                    if (!draft.preparer) {
                      alert("Please select who prepared it (name dropdown).");
                      return;
                    }
                    nav("/edit");
                  }}
                >
                  Continue to Edit Table →
                </button>
              </div>

              <div className="small">
                “Vendor Stock Number” will display as “Stock ID” automatically.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
