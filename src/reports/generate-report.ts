import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";
import type { OptimizationResult } from "@/domain/result";
import type { Project } from "@/domain/project";
import { formatMm, formatArea, formatMmPlain } from "@/calculations/units";

const MM_TO_PT = 2.834645669; // 1 mm = 2.8346 pt
const PAGE_W = 595.28; // A4 width in pt
const PAGE_H = 841.89; // A4 height in pt
const MARGIN = 36;

const toPt = (mm: number) => mm * MM_TO_PT;

const rgbColor = (hex: string): RGB => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
};

const PANEL_COLORS = [
  "#FDE68A",
  "#BFDBFE",
  "#BBF7D0",
  "#FBCFE8",
  "#DDD6FE",
  "#FED7AA",
  "#A7F3D0",
  "#BAE6FD",
].map(rgbColor);

const REUSABLE = rgbColor("#D1FAE5");
const SCRAP = rgbColor("#E5E7EB");
const BORDER = rgbColor("#1F2937");
const CUT_LINE = rgbColor("#9CA3AF");
const TEXT_DARK = rgbColor("#111827");
const TEXT_GRAY = rgbColor("#4B5563");

export async function generateReport(
  project: Project,
  result: OptimizationResult,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: global summary + sheet 1
  const page1 = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  y = drawGlobalSummary(page1, project, result, font, bold, y);
  y -= 20;
  if (result.sheets.length > 0) {
    drawSheetReport(page1, result.sheets[0], project.unit, font, bold, y, 1, result.sheets.length);
  }

  // Remaining sheet pages
  for (let i = 1; i < result.sheets.length; i++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    drawSheetReport(page, result.sheets[i], project.unit, font, bold, PAGE_H - MARGIN, i + 1, result.sheets.length);
  }

  // Final page: surplus register
  const surplusPage = doc.addPage([PAGE_W, PAGE_H]);
  drawSurplusRegister(surplusPage, result, font, bold);

  return doc.save();
};

const drawGlobalSummary = (
  page: PDFPage,
  project: Project,
  result: OptimizationResult,
  font: PDFFont,
  bold: PDFFont,
  startY: number,
): number => {
  let y = startY;

  page.drawText(project.name || "Untitled project", {
    x: MARGIN,
    y,
    size: 20,
    font: bold,
    color: TEXT_DARK,
  });
  y -= 14;
  const dateStr = new Date().toLocaleString();
  page.drawText(`Generated ${dateStr}`, {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: TEXT_GRAY,
  });
  y -= 22;

  y = drawSectionTitle(page, "Project Summary", font, bold, y);
  const settings: [string, string][] = [
    ["Measurement unit", project.unit],
    ["Kerf thickness", formatMmPlain(project.settings.kerf)],
    ["Allow rotation", project.settings.allowRotation ? "Yes" : "No"],
    ["Min reusable size", `${formatMmPlain(project.settings.minimumSurplusWidth)} × ${formatMmPlain(project.settings.minimumSurplusLength)}`],
  ];
  y = drawKeyValueTable(page, settings, font, y);

  y -= 10;
  const s = result.summary;
  const stats: [string, string][] = [
    ["Available sheets", String(s.availableSheetCount)],
    ["Used sheets", String(s.usedSheetCount)],
    ["Unused sheets", String(s.unusedSheetCount)],
    ["Available stock area", formatArea(s.availableStockArea)],
    ["Consumed stock area", formatArea(s.consumedStockArea)],
    ["Panel area", formatArea(s.placedPanelArea)],
    ["Reusable surplus", formatArea(s.reusableSurplusArea)],
    ["Scrap", formatArea(s.scrapArea)],
    ["Estimated kerf loss", formatArea(s.kerfLossArea)],
    ["Utilisation", `${s.utilisationPercent.toFixed(1)}%`],
    ["Wasted area", `${s.wastePercent.toFixed(1)}%`],
    ["Total cuts", String(s.totalCuts)],
    ["Total cutting length", formatMmPlain(s.totalCutLength)],
    ["Required panel area", formatArea(s.requiredPanelArea)],
    ["Theoretical difference", formatArea(s.theoreticalDifference)],
  ];
  y = drawKeyValueTable(page, stats, font, y);

  if (result.unplacedPanels.length > 0) {
    y -= 10;
    page.drawText(`Unplaced panels: ${result.unplacedPanels.length}`, {
      x: MARGIN,
      y,
      size: 11,
      font: bold,
      color: rgbColor("#DC2626"),
    });
    y -= 14;
    for (const up of result.unplacedPanels) {
      page.drawText(`  • ${up.displayLabel} (${formatMmPlain(up.width)} × ${formatMmPlain(up.length)})`, {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: TEXT_GRAY,
      });
      y -= 12;
    }
  }

  return y;
};

const drawSheetReport = (
  page: PDFPage,
  sheet: SheetResultLike,
  unit: MeasurementUnitLike,
  font: PDFFont,
  bold: PDFFont,
  startY: number,
  pageNum: number,
  totalPages: number,
): void => {
  let y = startY;

  page.drawText(`Sheet ${pageNum}: ${sheet.label}`, {
    x: MARGIN,
    y,
    size: 16,
    font: bold,
    color: TEXT_DARK,
  });
  y -= 18;

  const dimStr = `${formatMm(sheet.width, unit)} × ${formatMm(sheet.length, unit)}`;
  const matStr = sheet.material ? `${sheet.material}${sheet.thickness ? ` ${sheet.thickness} mm` : ""}` : "";
  page.drawText(`${dimStr}${matStr ? "  ·  " + matStr : ""}`, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: TEXT_GRAY,
  });
  y -= 20;

  // Two-column: left = stats + tables, right = diagram
  const colGap = 16;
  const leftColW = 170;
  const rightColX = MARGIN + leftColW + colGap;
  const rightColW = PAGE_W - MARGIN - rightColX;

  const stats: [string, string][] = [
    ["Sheet area", formatArea(sheet.statistics.sheetArea)],
    ["Panel area", formatArea(sheet.statistics.placedPanelArea)],
    ["Used area", `${sheet.statistics.utilisationPercent.toFixed(1)}%`],
    ["Wasted area", `${sheet.statistics.wastePercent.toFixed(1)}%`],
    ["Cuts", String(sheet.statistics.cutCount)],
    ["Cut length", formatMmPlain(sheet.statistics.cutLength)],
    ["Panels", String(sheet.statistics.panelCount)],
    ["Reusable surplus", formatArea(sheet.statistics.reusedSurplusArea)],
    ["Scrap", formatArea(sheet.statistics.scrapArea)],
  ];
  let leftY = y;
  leftY = drawKeyValueTable(page, stats, font, leftY, MARGIN, leftColW);

  leftY -= 12;
  page.drawText("Cut sequence", {
    x: MARGIN,
    y: leftY,
    size: 10,
    font: bold,
    color: TEXT_DARK,
  });
  leftY -= 14;
  for (const c of sheet.cuts.slice(0, 20)) {
    const line = `${c.number}. ${c.direction === "vertical" ? "V" : "H"} @ ${formatMmPlain(c.cutPosition)} · ${formatMmPlain(c.cutLength)}`;
    page.drawText(line, {
      x: MARGIN,
      y: leftY,
      size: 8,
      font,
      color: TEXT_GRAY,
    });
    leftY -= 11;
  }

  // Right column: diagram
  drawSheetDiagram(page, sheet, rightColX, y, rightColW, font, unit);

  // Footer
  const footerY = 24;
  page.drawText(`Page ${pageNum} of ${totalPages}`, {
    x: PAGE_W / 2 - 30,
    y: footerY,
    size: 9,
    font,
    color: TEXT_GRAY,
  });
};

const drawSheetDiagram = (
  page: PDFPage,
  sheet: SheetResultLike,
  x: number,
  yTop: number,
  maxW: number,
  _font: PDFFont,
  unit: MeasurementUnitLike,
): void => {
  const availH = yTop - 50;
  const scale = Math.min(maxW / sheet.width, availH / sheet.length);
  const drawW = sheet.width * scale;
  const drawH = sheet.length * scale;
  const originX = x;
  const originY = yTop - drawH;

  // Sheet border
  page.drawRectangle({
    x: originX,
    y: originY,
    width: drawW,
    height: drawH,
    borderColor: BORDER,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  // Surplus
  for (const s of sheet.surplus) {
    page.drawRectangle({
      x: originX + s.x * scale,
      y: originY + (sheet.length - s.y - s.length) * scale,
      width: s.width * scale,
      height: s.length * scale,
      color: s.reusable ? REUSABLE : SCRAP,
      borderColor: s.reusable ? rgbColor("#6EE7B7") : rgbColor("#9CA3AF"),
      borderWidth: 0.3,
    });
  }

  // Panels
  sheet.placements.forEach((p, i) => {
    const color = PANEL_COLORS[i % PANEL_COLORS.length];
    page.drawRectangle({
      x: originX + p.x * scale,
      y: originY + (sheet.length - p.y - p.length) * scale,
      width: p.width * scale,
      height: p.length * scale,
      color,
      borderColor: rgbColor("#4B5563"),
      borderWidth: 0.5,
    });
  });
};

const drawSurplusRegister = (
  page: PDFPage,
  result: OptimizationResult,
  font: PDFFont,
  bold: PDFFont,
): void => {
  let y = PAGE_H - MARGIN;
  page.drawText("Surplus Register", {
    x: MARGIN,
    y,
    size: 20,
    font: bold,
    color: TEXT_DARK,
  });
  y -= 26;

  const allSurplus = result.sheets.flatMap((s) => s.surplus.filter((p) => p.reusable));

  if (allSurplus.length === 0) {
    page.drawText("No reusable surplus pieces.", {
      x: MARGIN,
      y,
      size: 12,
      font,
      color: TEXT_GRAY,
    });
    return;
  }

  const headers = ["ID", "Source", "Size (mm)", "Area", "Label"];
  const colWidths = [80, 70, 110, 90, 140];
  let x = MARGIN;

  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x,
      y,
      size: 10,
      font: bold,
      color: TEXT_DARK,
    });
    x += colWidths[i];
  }
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: rgbColor("#D1D5DB"),
  });
  y -= 16;

  for (const s of allSurplus) {
    x = MARGIN;
    const rows = [
      s.id,
      s.sheetId.replace("sheet-", "Sheet "),
      `${Math.round(s.width)} × ${Math.round(s.length)}`,
      formatArea(s.area),
      s.suggestedLabel,
    ];
    for (let i = 0; i < rows.length; i++) {
      page.drawText(rows[i], {
        x,
        y,
        size: 9,
        font,
        color: TEXT_GRAY,
      });
      x += colWidths[i];
    }
    y -= 16;
    if (y < 50) break;
  }
};

const drawSectionTitle = (
  page: PDFPage,
  title: string,
  _font: PDFFont,
  bold: PDFFont,
  y: number,
): number => {
  page.drawText(title, {
    x: MARGIN,
    y,
    size: 13,
    font: bold,
    color: TEXT_DARK,
  });
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.8,
    color: rgbColor("#D1D5DB"),
  });
  return y - 16;
};

const drawKeyValueTable = (
  page: PDFPage,
  rows: [string, string][],
  font: PDFFont,
  y: number,
  x = MARGIN,
  maxWidth = PAGE_W - MARGIN - MARGIN,
): number => {
  let cy = y;
  for (const [key, value] of rows) {
    page.drawText(key, {
      x,
      y: cy,
      size: 9,
      font,
      color: TEXT_GRAY,
    });
    page.drawText(value, {
      x: x + maxWidth * 0.55,
      y: cy,
      size: 9,
      font,
      color: TEXT_DARK,
    });
    cy -= 13;
  }
  return cy;
};

type SheetResultLike = OptimizationResult["sheets"][number];
type MeasurementUnitLike = Project["unit"];
