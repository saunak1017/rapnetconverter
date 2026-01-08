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
  const headerWidth = font.widthOfTextAtSize(header, 10);
  page.drawText(header, { x: (pageWidth - headerWidth) / 2, y, size: 10, font, color: rgb(0.1, 0.24, 0.45) });
  y -= 16;

  if (data.preparedFor || data.request) {
    const preparedFor = sanitizeText(data.preparedFor);
    const requestText = sanitizeText(data.request);
    const boxTop = y;
    const boxLines: string[] = [];
    if (preparedFor) boxLines.push(`Prepared For: ${preparedFor}`);
    if (requestText) boxLines.push(`Request: ${requestText}`);
    const lineHeight = 14;
    const textHeight = boxLines.length * lineHeight;
    const boxHeight = textHeight + 12;
    const boxWidth = contentWidth * 0.78;
    page.drawRectangle({
      x: (pageWidth - boxWidth) / 2,
      y: boxTop - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: rgb(0.96, 0.97, 0.99),
      borderColor: rgb(0.8, 0.86, 0.94),
      borderWidth: 1,
    });
    y = boxTop - (boxHeight - textHeight) / 2 - 2;
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
  const rowHeight = 20;
  const headerFill = rgb(0.9, 0.93, 0.97);
  const gridColor = rgb(0.86, 0.89, 0.93);
  const zebraFill = rgb(0.97, 0.98, 0.99);
  const currencyKeys = new Set(["$/ct", "Total"]);
  const sizeKeys = new Set(["Size"]);

  function fitText(text: string, maxWidth: number, fontFace: any, size: number) {
    const sanitized = sanitizeText(text);
    if (fontFace.widthOfTextAtSize(sanitized, size) <= maxWidth) return sanitized;
    let clipped = sanitized;
    while (clipped.length > 0) {
      clipped = clipped.slice(0, -1);
      if (fontFace.widthOfTextAtSize(`${clipped}…`, size) <= maxWidth) return `${clipped}…`;
    }
    return "";
  }

  function drawTableHeader(startY: number) {
    const headerRowBottom = startY - rowHeight;
    page.drawRectangle({
      x: margin,
      y: headerRowBottom,
      width: contentWidth,
      height: rowHeight,
      color: headerFill,
    });
    columns.forEach((c, i) => {
      const label = fitText(c.label, colWidth - 8, fontBold, 9);
      const labelWidth = fontBold.widthOfTextAtSize(label, 9);
      page.drawText(label, {
        x: margin + i * colWidth + (colWidth - labelWidth) / 2,
        y: headerRowBottom + (rowHeight - 9) / 2,
        size: 9,
        font: fontBold,
        color: rgb(0.06, 0.1, 0.16),
      });
    });
    for (let i = 0; i <= colCount; i += 1) {
      const x = margin + i * colWidth;
      page.drawLine({
        start: { x, y: headerRowBottom },
        end: { x, y: headerRowBottom + rowHeight },
        thickness: 0.6,
        color: gridColor,
      });
    }
    page.drawLine({
      start: { x: margin, y: headerRowBottom },
      end: { x: margin + contentWidth, y: headerRowBottom },
      thickness: 0.6,
      color: gridColor,
    });
    return headerRowBottom;
  }

  y = drawTableHeader(y) - 4;

  const rows = data.rows ?? [];
  rows.forEach((rowData, rowIndex) => {
    if (y < margin + rowHeight * 2) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawLine();
      y = drawTableHeader(y) - 4;
    }

    const rowBottom = y - rowHeight;
    if (columns.length > 0) {
      page.drawRectangle({
        x: margin,
        y: rowBottom,
        width: contentWidth,
        height: rowHeight,
        color: rowIndex % 2 === 0 ? zebraFill : rgb(1, 1, 1),
      });
    }

    columns.forEach((c, i) => {
      const rawValue = rowData[c.key];
      const rawText = currencyKeys.has(c.key)
        ? formatCurrency(rawValue)
        : sizeKeys.has(c.key)
          ? formatSize(rawValue)
          : sanitizeText(rawValue);
      const text = fitText(rawText, colWidth - 10, font, 8.5);
      const textWidth = font.widthOfTextAtSize(text, 8.5);
      page.drawText(text, {
        x: margin + i * colWidth + (colWidth - textWidth) / 2,
        y: rowBottom + (rowHeight - 8.5) / 2,
        size: 8.5,
        font,
        color: rgb(0.15, 0.18, 0.24),
      });
    });

    for (let i = 0; i <= colCount; i += 1) {
      const x = margin + i * colWidth;
      page.drawLine({
        start: { x, y: rowBottom },
        end: { x, y: rowBottom + rowHeight },
        thickness: 0.5,
        color: gridColor,
      });
    }
    page.drawLine({
      start: { x: margin, y: rowBottom },
      end: { x: margin + contentWidth, y: rowBottom },
      thickness: 0.6,
      color: gridColor,
    });

    y = rowBottom - 4;
  });

  const pdfBytes = await pdf.save();
  return new Response(pdfBytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="client-output-${slug}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
