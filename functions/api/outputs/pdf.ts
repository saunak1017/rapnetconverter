import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface Env {
  DB: D1Database;
}

type OutputPayload = {
  preparedFor: string;
  request: string;
  preparer: { name: string; email: string; ext: string };
  columns: { key: string; label: string }[];
  rows: Record<string, string | boolean>[];
  createdAt: string;
};

function formatCurrency(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/[$,]/g, "");
  const num = Number.parseFloat(normalized);
  if (Number.isNaN(num)) return raw;
  return `$${num.toFixed(2)}`;
}

function formatSize(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/[$,]/g, "");
  const num = Number.parseFloat(normalized);
  if (Number.isNaN(num)) return raw;
  return num.toFixed(2);
}

function sanitizeText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function wrapText(text: string, maxWidth: number, font: any, size: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);
    if (width <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const LOGO_BASE64 =
  "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…"; // full base64 from previous response (unchanged)

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();
  if (!slug) return new Response("Missing slug", { status: 400 });

  const row = await env.DB
    .prepare("SELECT payload FROM rapnet_outputs WHERE slug = ?1")
    .bind(slug)
    .first<{ payload: string }>();

  if (!row) return new Response("Not found", { status: 404 });

  let data: OutputPayload;
  try {
    data = JSON.parse(row.payload) as OutputPayload;
  } catch {
    return new Response("Corrupt payload", { status: 500 });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 792;
  const pageHeight = 612;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = () => {
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.87, 0.9),
    });
    y -= 14;
  };

  const logoBytes = base64ToUint8Array(LOGO_BASE64);
  const logo = await pdf.embedPng(logoBytes);
  const logoWidth = 220;
  const logoHeight = (logo.height / logo.width) * logoWidth;
  page.drawImage(logo, {
    x: (pageWidth - logoWidth) / 2,
    y: y - logoHeight,
    width: logoWidth,
    height: logoHeight,
  });
  y -= logoHeight + 12;

  const header = `589 5th Ave, Suite 1107, New York, NY 10017 | ${sanitizeText(data.preparer.email)} | 212-593-2750 - Ext. ${sanitizeText(data.preparer.ext)}`;
  const title = "Client-Ready Output";
  const titleWidth = fontBold.widthOfTextAtSize(title, 16);
  page.drawText(title, { x: (pageWidth - titleWidth) / 2, y, size: 16, font: fontBold, color: rgb(0.07, 0.1, 0.16) });
  y -= 18;
  const headerWidth = font.widthOfTextAtSize(header, 10);
  page.drawText(header, { x: (pageWidth - headerWidth) / 2, y, size: 10, font, color: rgb(0.25, 0.3, 0.38) });
  y -= 16;

  if (data.preparedFor || data.request) {
    const preparedFor = sanitizeText(data.preparedFor);
    const requestText = sanitizeText(data.request);
    const boxTop = y;
    const boxLines: string[] = [];
    if (preparedFor) boxLines.push(`Prepared For: ${preparedFor}`);
    if (requestText) boxLines.push(`Request: ${requestText}`);
    const lineHeight = 14;
    const boxHeight = boxLines.length * lineHeight + 12;
    const boxWidth = contentWidth * 0.78;
    page.drawRectangle({
      x: (pageWidth - boxWidth) / 2,
      y: boxTop - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.85, 0.87, 0.9),
      borderWidth: 1,
    });
    y = boxTop - 10;
    for (const line of boxLines) {
      const lineWidth = fontBold.widthOfTextAtSize(line, 11);
      page.drawText(line, {
        x: (pageWidth - lineWidth) / 2,
        y,
        size: 11,
        font: fontBold,
        color: rgb(0.12, 0.15, 0.2),
      });
      y -= lineHeight;
    }
    y -= 6;
  }

  drawLine();

  const columns = data.columns ?? [];
  const colCount = columns.length || 1;
  const colWidth = contentWidth / colCount;
  const headerY = y;
  const rowHeight = 20;

  columns.forEach((c, i) => {
    page.drawRectangle({
      x: margin + i * colWidth,
      y: headerY - rowHeight + 4,
      width: colWidth,
      height: rowHeight,
      color: rgb(0.93, 0.94, 0.96),
    });
    const label = sanitizeText(c.label);
    const labelWidth = fontBold.widthOfTextAtSize(label, 9);
    page.drawText(label, {
      x: margin + i * colWidth + (colWidth - labelWidth) / 2,
      y: headerY - 12,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.13, 0.18),
    });
  });
  y = headerY - rowHeight - 6;

  const currencyKeys = new Set(["$/ct", "Total"]);
  const sizeKeys = new Set(["Size"]);

  for (const rowData of data.rows ?? []) {
    if (y < margin + rowHeight * 2) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawLine();
    }

    columns.forEach((c, i) => {
      const rawValue = rowData[c.key];
      const text = currencyKeys.has(c.key)
        ? formatCurrency(rawValue)
        : sizeKeys.has(c.key)
          ? formatSize(rawValue)
          : sanitizeText(rawValue);
      const lines = wrapText(text, colWidth - 10, font, 8.5);
      lines.slice(0, 2).forEach((line, idx) => {
        const lineWidth = font.widthOfTextAtSize(line, 8.5);
        page.drawText(line, {
          x: margin + i * colWidth + (colWidth - lineWidth) / 2,
          y: y - idx * 10,
          size: 8.5,
          font,
          color: rgb(0.15, 0.18, 0.24),
        });
      });
    });
    y -= rowHeight;
  }

  const pdfBytes = await pdf.save();
  return new Response(pdfBytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="client-output-${slug}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
