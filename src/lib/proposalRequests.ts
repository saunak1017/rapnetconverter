import { isPerCaratColumn, isTotalColumn } from "./columnMatchers";
import { formatCurrency } from "./formatValues";
import type { ColumnDef, RapRow } from "./types";

export type RequestType = "memo" | "hold";
export type StoneSelection = { type: RequestType; comments: string };
export type RequestColumns = {
  styleNumber: string | null;
  identifierKeys?: string[];
  perCarat: string | null;
  total: string | null;
};

const identifierAliases = [
  ["stylenumber", "styleno", "style#", "styleid"],
  ["stockid", "stocknumber", "stockno", "stock#"],
  ["lotid", "lotnumber", "lotno", "lot#"],
  ["vendorstocknumber", "vendorstockno", "vendorstockid", "vendorstock#"],
];

function identifierRank(col: ColumnDef) {
  return identifierAliases.findIndex((aliases) => [col.key, col.label].some((value) =>
    aliases.includes(value.trim().toLowerCase().replace(/[\s._-]/g, ""))
  ));
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
  const identifierKeys = candidates.filter((col) => identifierRank(col) >= 0)
    .sort((a, b) => identifierRank(a) - identifierRank(b)).map((col) => col.key);
  return {
    styleNumber: identifierKeys[0] ?? null,
    identifierKeys,
    perCarat: candidates.find(isPerCaratColumn)?.key ?? null,
    total: candidates.find(isTotalColumn)?.key ?? null,
  };
}

export function getStoneSummary(row: RapRow, columns: RequestColumns) {
  // Discover row keys too so older saved proposals gain the new fallbacks.
  const keys = [...new Set([
    ...(columns.styleNumber ? [columns.styleNumber] : []),
    ...(columns.identifierKeys ?? []),
    ...(getRequestColumns([], [row]).identifierKeys ?? []),
  ])];
  const identifier = keys.map((key) => String(row[key] ?? "").trim()).find(Boolean);
  return {
    styleNumber: identifier || "Not provided",
    perCarat: (columns.perCarat && formatCurrency(row[columns.perCarat])) || "Not provided",
    total: (columns.total && formatCurrency(row[columns.total])) || "Not provided",
  };
}
