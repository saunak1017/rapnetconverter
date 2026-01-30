import type { ColumnDef } from "./types";

type ColumnLike = ColumnDef | string;

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCompact(value: string): string {
  return normalizeHeader(value).replace(/\s+/g, "");
}

function columnStrings(col: ColumnLike): string[] {
  return typeof col === "string" ? [col] : [col.key, col.label];
}

function matchesPerCarat(value: string): boolean {
  const compact = normalizeCompact(value).replace(/\./g, "");
  const cleaned = compact.replace(/[^a-z0-9/$]/g, "");
  const candidates = [compact, cleaned];
  return candidates.some((candidate) =>
    ["$/ct", "$/carat", "percarat", "price/ct", "pricepercarat"].includes(candidate)
  );
}

function matchesSize(value: string): boolean {
  const normalized = normalizeHeader(value);
  const compact = normalizeCompact(value).replace(/\./g, "");
  return ["size", "carat", "carats"].includes(normalized) || ["ct", "ctw", "caratwt"].includes(compact);
}

function matchesTotal(value: string): boolean {
  const normalized = normalizeHeader(value).replace(/\$/g, "");
  return ["total", "total price"].includes(normalized);
}

export function isPerCaratColumn(col: ColumnLike): boolean {
  return columnStrings(col).some(matchesPerCarat);
}

export function isSizeColumn(col: ColumnLike): boolean {
  return columnStrings(col).some(matchesSize);
}

export function isTotalColumn(col: ColumnLike): boolean {
  return columnStrings(col).some(matchesTotal);
}

export function isCurrencyColumn(col: ColumnLike): boolean {
  return isPerCaratColumn(col) || isTotalColumn(col);
}
