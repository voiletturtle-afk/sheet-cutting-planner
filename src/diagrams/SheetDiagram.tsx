import { useMemo } from "react";
import type { SheetResult } from "@/domain/result";
import type { MeasurementUnit } from "@/domain/project";
import { formatMm } from "@/calculations/units";

type Props = {
  sheet: SheetResult;
  unit: MeasurementUnit;
  selectedPanelId?: string;
  onSelectPanel?: (panelInstanceId: string) => void;
  maxWidth?: number;
};

const PANEL_PALETTE = [
  "#FDE68A",
  "#BFDBFE",
  "#BBF7D0",
  "#FBCFE8",
  "#DDD6FE",
  "#FED7AA",
  "#A7F3D0",
  "#BAE6FD",
];

const REUSABLE_COLOR = "#D1FAE5";
const SCRAP_COLOR = "#E5E7EB";
const SHEET_BORDER = "#1F2937";
const CUT_LINE = "#9CA3AF";

export function SheetDiagram({
  sheet,
  unit,
  selectedPanelId,
  onSelectPanel,
  maxWidth = 700,
}: Props) {
  const scale = useMemo(() => {
    const maxDim = Math.max(sheet.width, sheet.length);
    return maxWidth / maxDim;
  }, [sheet.width, sheet.length, maxWidth]);

  const displayW = sheet.width * scale;
  const displayH = sheet.length * scale;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={displayW}
        height={displayH}
        viewBox={`0 0 ${sheet.width} ${sheet.length}`}
        style={{ maxWidth: "100%" }}
      >
        <rect
          x={0}
          y={0}
          width={sheet.width}
          height={sheet.length}
          fill="#FFFFFF"
          stroke={SHEET_BORDER}
          strokeWidth={Math.max(2, 3 / scale)}
        />

        {sheet.surplus.map((s, i) => {
          if (!s.reusable) return null;
          return (
            <g key={`surplus-${i}`}>
              <rect
                x={s.x}
                y={s.y}
                width={s.width}
                height={s.length}
                fill={REUSABLE_COLOR}
                stroke="#6EE7B7"
                strokeWidth={Math.max(0.5, 1 / scale)}
              />
              {fitText(s.width, s.length, scale) && (
                <text
                  x={s.x + s.width / 2}
                  y={s.y + s.length / 2}
                  fontSize={fontSizeForRect(s.width, s.length, scale)}
                  fill="#065F46"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {formatMm(s.width, unit)} × {formatMm(s.length, unit)}
                </text>
              )}
            </g>
          );
        })}

        {sheet.surplus.map((s, i) => {
          if (s.reusable) return null;
          return (
            <rect
              key={`scrap-${i}`}
              x={s.x}
              y={s.y}
              width={s.width}
              height={s.length}
              fill={SCRAP_COLOR}
              stroke="#9CA3AF"
              strokeWidth={Math.max(0.3, 0.5 / scale)}
            />
          );
        })}

        {sheet.placements.map((p, i) => {
          const color = PANEL_PALETTE[i % PANEL_PALETTE.length];
          const selected = p.panelInstanceId === selectedPanelId;
          const label = p.displayLabel;
          return (
            <g
              key={p.panelInstanceId}
              onClick={() => onSelectPanel?.(p.panelInstanceId)}
              style={{ cursor: onSelectPanel ? "pointer" : "default" }}
            >
              <rect
                x={p.x}
                y={p.y}
                width={p.width}
                height={p.length}
                fill={color}
                stroke={selected ? "#DC2626" : "#4B5563"}
                strokeWidth={selected ? Math.max(3, 4 / scale) : Math.max(1, 1.5 / scale)}
              />
              {fitText(p.width, p.length, scale) && (
                <text
                  x={p.x + p.width / 2}
                  y={p.y + p.length / 2 - 10 / scale}
                  fontSize={fontSizeForRect(p.width, p.length, scale)}
                  fill="#111827"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {truncateLabel(label, p.width, p.length, scale)}
                </text>
              )}
              <text
                x={p.x + p.width / 2}
                y={p.y + p.length / 2 + 10 / scale}
                fontSize={fontSizeForRect(p.width, p.length, scale) * 0.8}
                fill="#374151"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {formatMm(p.width, unit)}×{formatMm(p.length, unit)}
              </text>
            </g>
          );
        })}

        {sheet.cuts.map((c) => {
          const stroke = CUT_LINE;
          const sw = Math.max(0.5, 1 / scale);
          if (c.direction === "vertical") {
            return (
              <g key={`cut-${c.number}`}>
                <line
                  x1={c.cutPosition}
                  y1={c.sourceRegion.y}
                  x2={c.cutPosition}
                  y2={c.sourceRegion.y + c.sourceRegion.height}
                  stroke={stroke}
                  strokeWidth={sw}
                  strokeDasharray={`${4 / scale} ${2 / scale}`}
                />
                <text
                  x={c.cutPosition}
                  y={c.sourceRegion.y}
                  fontSize={Math.max(10, 14 / scale)}
                  fill="#1F2937"
                  textAnchor="middle"
                >
                  {c.number}
                </text>
              </g>
            );
          }
          return (
            <g key={`cut-${c.number}`}>
              <line
                x1={c.sourceRegion.x}
                y1={c.cutPosition}
                x2={c.sourceRegion.x + c.sourceRegion.width}
                y2={c.cutPosition}
                stroke={stroke}
                strokeWidth={sw}
                strokeDasharray={`${4 / scale} ${2 / scale}`}
              />
              <text
                x={c.sourceRegion.x}
                y={c.cutPosition}
                fontSize={Math.max(10, 14 / scale)}
                fill="#1F2937"
                textAnchor="middle"
              >
                {c.number}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
        <LegendItem color="#FDE68A" label="Panels" />
        <LegendItem color={REUSABLE_COLOR} label="Reusable surplus" />
        <LegendItem color={SCRAP_COLOR} label="Scrap" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

const fitText = (w: number, h: number, scale: number): boolean => {
  const minDisplay = 45;
  return w * scale >= minDisplay && h * scale >= minDisplay;
};

const fontSizeForRect = (w: number, h: number, scale: number): number => {
  const minDim = Math.min(w, h);
  const size = minDim * 0.12;
  const max = Math.max(14, 22 / scale);
  const min = Math.max(8, 10 / scale);
  return Math.min(max, Math.max(min, size));
};

const truncateLabel = (label: string, w: number, h: number, scale: number): string => {
  const displayW = w * scale;
  const maxChars = Math.floor(displayW / 7);
  if (label.length <= maxChars) return label;
  if (maxChars < 4) return label.slice(0, 2);
  return label.slice(0, maxChars - 1) + "…";
};
