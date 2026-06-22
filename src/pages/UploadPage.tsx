import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { parseRapnetFile } from "../lib/parseFile";
import { displayLabelForHeader } from "../lib/headerMap";
import type { DraftState, ColumnDef, MediaAttachment, RapRow } from "../lib/types";

const MEDIA_EXTENSIONS = new Set(["png", "jpg", "jpeg", "mp4"]);
const STOCK_ID_HEADERS = ["stock id", "lot id", "vendor stock number"];

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function getBaseName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return (lastDot >= 0 ? fileName.slice(0, lastDot) : fileName).trim().toLowerCase();
}

function findStockKey(columns: string[]) {
  return columns.find((column) => STOCK_ID_HEADERS.includes(column.trim().toLowerCase())) ?? null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function buildMediaByRowIndex(
  mediaFiles: File[],
  columns: string[],
  rows: RapRow[]
): Promise<{ mediaByRowIndex: Record<string, MediaAttachment>; matchedCount: number; unmatchedNames: string[] }> {
  const stockKey = findStockKey(columns);
  if (!stockKey || mediaFiles.length === 0) {
    return { mediaByRowIndex: {}, matchedCount: 0, unmatchedNames: mediaFiles.map((file) => file.name) };
  }

  const rowIndexByStoneId = new Map<string, number>();
  rows.forEach((row, index) => {
    const stoneId = String(row[stockKey] ?? "").trim().toLowerCase();
    if (stoneId && !rowIndexByStoneId.has(stoneId)) rowIndexByStoneId.set(stoneId, index);
  });

  const mediaByRowIndex: Record<string, MediaAttachment> = {};
  const unmatchedNames: string[] = [];

  for (const file of mediaFiles) {
    const extension = getExtension(file.name);
    const rowIndex = rowIndexByStoneId.get(getBaseName(file.name));
    if (!MEDIA_EXTENSIONS.has(extension) || rowIndex === undefined || mediaByRowIndex[rowIndex]) {
      unmatchedNames.push(file.name);
      continue;
    }

    mediaByRowIndex[rowIndex] = {
      fileName: file.name,
      mediaType: extension === "mp4" ? "video" : "image",
      dataUrl: await readAsDataUrl(file),
    };
  }

  return {
    mediaByRowIndex,
    matchedCount: Object.keys(mediaByRowIndex).length,
    unmatchedNames,
  };
}

export function UploadPage() {
  const [error, setError] = useState<string | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function handleContinue() {
    setError(null);
    if (!excelFile) {
      setError("Please choose a RapNet export first.");
      return;
    }

    try {
      setBusy(true);
      const { columns, rows } = await parseRapnetFile(excelFile);
      const { mediaByRowIndex, matchedCount, unmatchedNames } = await buildMediaByRowIndex(mediaFiles, columns, rows);

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
        mediaByRowIndex,
      };

      sessionStorage.setItem("draft", JSON.stringify(draft));
      sessionStorage.setItem("hiddenKeys", JSON.stringify([]));
      sessionStorage.setItem("mediaUploadSummary", JSON.stringify({
        selectedCount: mediaFiles.length,
        matchedCount,
        unmatchedNames,
      }));
      nav("/configure");
    } catch (err: any) {
      setError(err?.message ?? "Failed to parse file.");
    } finally {
      setBusy(false);
    }
  }

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
          onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
        />

        <div style={{ marginTop: 16 }}>
          <div className="small" style={{ marginBottom: 8 }}>
            Optional stone image/video files. File names should match Stock ID, Lot ID, or Vendor Stock Number.
          </div>
          <input
            className="input"
            type="file"
            accept=".png,.PNG,.jpg,.jpeg,.JPG,.JPEG,.mp4,.MP4"
            multiple
            disabled={busy}
            onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        <button
          style={{ marginTop: 16 }}
          className="btn primary"
          disabled={busy}
          onClick={handleContinue}
        >
          {busy ? "Preparing…" : "Continue"}
        </button>

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
