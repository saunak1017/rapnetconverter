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
  const logoResponse = await fetch(new URL("/company-logo.PNG", request.url));
  if (logoResponse.ok) {
    const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
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
  }

  const header = `589 5th Ave, Suite 1107, New York, NY 10017 | ${sanitizeText(data.preparer.email)} | 212-593-2750 - Ext. ${sanitizeText(data.preparer.ext)}`;
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
