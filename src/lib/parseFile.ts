import * as XLSX from "xlsx";
import type { RapRow } from "./types";

function cleanHeader(h: unknown, idx: number): string {
  const s = String(h ?? "").trim();
  return s.length ? s : `Column ${idx + 1}`;
}

export async function parseRapnetFile(file: File): Promise<{ columns: string[]; rows: RapRow[] }> {
  const buf = await file.arrayBuffer();

  // SheetJS can read xlsx and csv via read()
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("No sheets found in the file.");

  const ws = wb.Sheets[sheetName];
  const sheetAsArrays: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

  if (!sheetAsArrays.length) throw new Error("File appears empty.");

  const headersRaw = sheetAsArrays[0] || [];
  const headers = headersRaw.map((h, idx) => cleanHeader(h, idx));
  const keptHeaders = headers
    .map((h, idx) => ({ header: h, idx }))
    .filter(({ header }) => header.toLowerCase() !== "item page");

  const rows: RapRow[] = [];
  for (let r = 1; r < sheetAsArrays.length; r++) {
    const rowArr = sheetAsArrays[r] || [];
    // skip fully empty lines
    const isEmpty = rowArr.every((v) => String(v ?? "").trim() === "");
    if (isEmpty) continue;

    const obj: RapRow = {};
    keptHeaders.forEach(({ header, idx }) => {
      obj[header] = String(rowArr[idx] ?? "").trim();
    });
    rows.push(obj);
  }

  return { columns: keptHeaders.map(({ header }) => header), rows };
}
