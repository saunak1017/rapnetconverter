import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseRapnetFile } from "../lib/parseFile";
import { displayLabelForHeader } from "../lib/headerMap";
import type { DraftState, ColumnDef } from "../lib/types";

export function UploadPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  return (
    <div className="container">
      <div className="card">
        <div className="h1">RapNet → Client-Ready Output</div>
        <p className="p">
          Upload a RapNet export (.csv or .xlsx). You’ll reorder columns, add header info, optionally edit rows,
          then generate a shareable client link.
        </p>

        <hr />

        <input
          className="input"
          type="file"
          accept=".csv,.xlsx"
          disabled={busy}
          onChange={async (e) => {
            setError(null);
            const file = e.target.files?.[0];
            if (!file) return;

            try {
              setBusy(true);
              const { columns, rows } = await parseRapnetFile(file);

              const colDefs: ColumnDef[] = columns.map((c) => ({
                key: c,
                label: displayLabelForHeader(c),
              }));

              const draft: DraftState = {
                rawColumns: columns,
                columns: colDefs,
                rows,
                preparedFor: "",
                request: "",
                preparer: null,
              };

              sessionStorage.setItem("draft", JSON.stringify(draft));
              sessionStorage.setItem("hiddenKeys", JSON.stringify([]));
              nav("/configure");
            } catch (err: any) {
              setError(err?.message ?? "Failed to parse file.");
            } finally {
              setBusy(false);
            }
          }}
        />

        <div style={{ marginTop: 12 }} className="small">
          Supports changing column sets — we detect headers automatically every upload.
        </div>

        {error && (
          <div style={{ marginTop: 14, color: "#fca5a5" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
