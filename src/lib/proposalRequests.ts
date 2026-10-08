import { isPerCaratColumn, isTotalColumn } from "./columnMatchers";
import { formatCurrency } from "./formatValues";
import type { ColumnDef, RapRow } from "./types";

export type RequestType = "memo" | "hold";
export type StoneSelection = { type: RequestType; comments: string };
export type RequestColumns = {
  styleNumber: string | null;
  perCarat: string | null;
  total: string | null;
};

function isStyleNumber(col: ColumnDef) {
  return [col.key, col.label].some((value) =>
    ["stylenumber", "styleno", "style#", "styleid"].includes(
      value.trim().toLowerCase().replace(/[\s.]/g, "")
    )
  );
}

// Preserve the original keys even if columns are hidden or their labels renamed.
export function getRequestColumns(columns: ColumnDef[], rows: RapRow[]): RequestColumns {
  const keys = new Set(columns.map((column) => column.key));
  const candidates = [...columns];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!keys.has(key)) {
        keys.add(key);
        candidates.push({ key, label: key });
      }
    }
  }
  return {
    styleNumber: candidates.find(isStyleNumber)?.key ?? null,
    perCarat: candidates.find(isPerCaratColumn)?.key ?? null,
    total: candidates.find(isTotalColumn)?.key ?? null,
  };
}

export function getStoneSummary(row: RapRow, columns: RequestColumns) {
  return {
    styleNumber: columns.styleNumber ? String(row[columns.styleNumber] ?? "").trim() || "Not provided" : "Not provided",
    perCarat: (columns.perCarat && formatCurrency(row[columns.perCarat])) || "Not provided",
    total: (columns.total && formatCurrency(row[columns.total])) || "Not provided",
  };
}
