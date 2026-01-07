import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { ColumnDef, Preparer, RapRow } from "../lib/types";

type OutputPayload = {
  preparedFor: string;
  request: string;
  preparer: Preparer;
  columns: ColumnDef[];
  rows: RapRow[];
  createdAt: string;
};

export function PublicPage() {
  const { slug } = useParams();
  const [data, setData] = useState<OutputPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        const res = await fetch(`/api/outputs/${slug}`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (!cancelled) setData(json as OutputPayload);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load output.");
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const headerLine = useMemo(() => {
    if (!data) return "";
    return `589 5th Ave, Suite 1107, New York, NY 10017 | ${data.preparer.email} | 212-593-2750 - Ext. ${data.preparer.ext}`;
  }, [data]);

  const currencyKeys = useMemo(() => new Set(["$/ct", "Total"]), []);
  const sizeKeys = useMemo(() => new Set(["Size"]), []);

  function formatNumber(value: unknown) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const normalized = raw.replace(/[$,]/g, "");
    const num = Number.parseFloat(normalized);
    if (Number.isNaN(num)) return null;
    return num;
  }

  function formatCurrency(value: unknown) {
    const num = formatNumber(value);
    if (num === null) return String(value ?? "");
    return `$${num.toFixed(2)}`;
  }

  function formatSize(value: unknown) {
    const num = formatNumber(value);
    if (num === null) return String(value ?? "");
    return num.toFixed(2);
  }

  function handleDownloadPdf() {
    window.print();
  }

  // Client-facing look: lighter background, white page
  return (
    <div style={{ background: "radial-gradient(circle at top, #1f2937 0%, #0f172a 45%, #020617 100%)", minHeight: "100vh", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 22px 48px" }}>
        {!data && !err && <div style={{ color: "#334155" }}>Loading…</div>}
        {err && <div style={{ color: "#b91c1c" }}>{err}</div>}

        {data && (
          <>
            <style>{`
              @media print {
                body {
                  background: #ffffff !important;
                  color: #0f172a !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}</style>
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
              <img src="/company-logo.PNG" alt="Company Logo" style={{ maxHeight: 76, width: "auto" }} />
            </div>

            <div style={{ textAlign: "center", color: "#e2e8f0", fontSize: 15, marginBottom: 20 }}>
              {headerLine}
            </div>

            <div className="no-print" style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <button className="btn primary" onClick={handleDownloadPdf}>
                Download PDF
              </button>
            </div>

            {(data.preparedFor || data.request) && (
              <div style={{
                border: "1px solid rgba(148,163,184,.3)",
                borderRadius: 16,
                padding: "16px 20px",
                margin: "0 auto 20px",
                background: "rgba(15,23,42,.7)",
                boxShadow: "0 16px 30px rgba(2,6,23,.45)",
                textAlign: "center",
                maxWidth: 620
              }}>
                {data.preparedFor && (
                  <div style={{ marginBottom: 6 }}>
                    <b>Prepared For:</b> {data.preparedFor}
                  </div>
                )}
                {data.request && (
                  <div>
                    <b>Request:</b> {data.request}
                  </div>
                )}
              </div>
            )}

            <div style={{
              border: "1px solid rgba(148,163,184,.25)",
              borderRadius: 18,
              overflow: "auto",
              background: "rgba(15,23,42,.65)",
              boxShadow: "0 18px 40px rgba(2,6,23,.55)"
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "linear-gradient(90deg,#0f172a 0%, #1e293b 100%)" }}>
                    {data.columns.map((c) => (
                      <th key={c.key} style={{
                        textAlign: "center",
                        padding: "14px 10px",
                        borderBottom: "1px solid rgba(148,163,184,.3)",
                        whiteSpace: "nowrap",
                        fontWeight: 700,
                        color: "#f8fafc",
                        letterSpacing: 0.3
                      }}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "rgba(30,41,59,.35)" : "transparent" }}>
                      {data.columns.map((c) => (
                        <td key={c.key} style={{
                          padding: "12px 10px",
                          borderBottom: "1px solid rgba(148,163,184,.2)",
                          whiteSpace: "nowrap",
                          textAlign: "center"
                        }}>
                          {currencyKeys.has(c.key)
                            ? formatCurrency(r[c.key])
                            : (sizeKeys.has(c.key) || c.key.trim().toLowerCase() === "size" || c.label.trim().toLowerCase() === "size")
                              ? formatSize(r[c.key])
                              : (r[c.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: "#64748b", textAlign: "center" }}>
              Generated by Shivani Gems internal tool
            </div>
          </>
        )}
      </div>
    </div>
  );
}
