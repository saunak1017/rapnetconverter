import type { RapRow } from "./types";

export const MEDIA_EXTENSIONS = new Set(["png", "jpg", "jpeg", "mp4"]);

const MEDIA_ID_HEADERS = new Set([
  "stock id",
  "lot id",
  "vendor stock number",
  "style number",
  "style no",
  "style no.",
  "style #",
]);

export function getMediaExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function normalizeMediaIdentifier(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function getMediaBaseName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return normalizeMediaIdentifier(lastDot >= 0 ? fileName.slice(0, lastDot) : fileName);
}

export function buildRowIndexByMediaId(columns: string[], rows: RapRow[]): Map<string, number> {
  const identifierColumns = columns.filter((column) =>
    MEDIA_ID_HEADERS.has(normalizeMediaIdentifier(column))
  );
  const rowIndexByMediaId = new Map<string, number>();

  rows.forEach((row, index) => {
    identifierColumns.forEach((column) => {
      const identifier = normalizeMediaIdentifier(row[column]);
      if (identifier && !rowIndexByMediaId.has(identifier)) {
        rowIndexByMediaId.set(identifier, index);
      }
    });
  });

  return rowIndexByMediaId;
}
