import { useState, useEffect } from "react";
import { Download, ArrowLeft, FileText } from "lucide-react";
import type { OptimizationResult } from "@/domain/result";
import type { Project } from "@/domain/project";
import { SheetDiagram } from "@/diagrams/SheetDiagram";
import { formatMm, formatArea, formatMmPlain } from "@/calculations/units";
import { generateReport } from "@/reports/generate-report";
import { buildFilename } from "@/storage/project-file";

type Props = {
  project: Project;
  result: OptimizationResult;
  onBack: () => void;
};

export function ResultsView({ project, result, onBack }: Props) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [selectedPanel, setSelectedPanel] = useState<string | undefined>();
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const sheet = result.sheets[activeSheet];

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const bytes = await generateReport(project, result);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename(project, "pdf");
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to editor
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors font-medium"
          >
            <FileText className="w-4 h-4" />
            {generatingPdf ? "Generating..." : "Download PDF Report"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SummaryPanel project={project} result={result} />
        </div>

        {result.stockRecommendation && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <h3 className="font-semibold text-amber-900">
                Additional stock required
                </h3>

                <p className="mt-1 text-sm text-amber-800">
                The entered panel quantities exceed the available stock.
                Add{" "}
                <strong>
                    {result.stockRecommendation.additionalQuantity}
                </strong>{" "}
                more{" "}
                <strong>{result.stockRecommendation.label}</strong>
                {result.stockRecommendation.additionalQuantity === 1 ? "" : " sheets"}.
                </p>

                <div className="mt-2 text-sm text-amber-800">
                Available quantity:{" "}
                {result.stockRecommendation.currentQuantity}
                <br />
                Suggested total quantity:{" "}
                {result.stockRecommendation.requiredQuantity}
                </div>
            </div>
            )}

        {result.unplacedPanels.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="font-semibold text-red-800 mb-2">
              Unplaced panels ({result.unplacedPanels.length})
            </h3>
            <div className="space-y-1">
              {result.unplacedPanels.map((p) => (
                <div key={p.panelInstanceId} className="text-sm text-red-700">
                  {p.displayLabel} — {formatMmPlain(p.width)} × {formatMmPlain(p.length)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-1 border-b border-gray-200 overflow-x-auto">
          {result.sheets.map((s, i) => (
            <button
              key={s.sheetInstanceId}
              onClick={() => {
                setActiveSheet(i);
                setSelectedPanel(undefined);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeSheet === i
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Sheet {i + 1}
            </button>
          ))}
        </div>

        {sheet && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <SheetStats sheet={sheet} unit={project.unit} />
              <CutTable sheet={sheet} />
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <SheetDiagram
                  sheet={sheet}
                  unit={project.unit}
                  selectedPanelId={selectedPanel}
                  onSelectPanel={setSelectedPanel}
                  maxWidth={600}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryPanel({ project, result }: { project: Project; result: OptimizationResult }) {
  const s = result.summary;
  const rows: [string, string][] = [
    ["Used sheets", String(s.usedSheetCount)],
    ["Unused sheets", String(s.unusedSheetCount)],
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

  return (
    <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{project.name} — Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard label="Utilisation" value={`${s.utilisationPercent.toFixed(1)}%`} accent="green" />
        <StatCard label="Used sheets" value={String(s.usedSheetCount)} accent="blue" />
        <StatCard label="Panel area" value={formatArea(s.placedPanelArea)} accent="blue" />
        <StatCard label="Reusable surplus" value={formatArea(s.reusableSurplusArea)} accent="green" />
        <StatCard label="Scrap" value={formatArea(s.scrapArea)} accent="gray" />
        <StatCard label="Kerf loss" value={formatArea(s.kerfLossArea)} accent="gray" />
        <StatCard label="Total cuts" value={String(s.totalCuts)} accent="blue" />
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-gray-100 py-1">
            <span className="text-gray-500">{k}</span>
            <span className="font-medium text-gray-900">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SheetStats({ sheet, unit }: { sheet: OptimizationResult["sheets"][number]; unit: Project["unit"] }) {
  const st = sheet.statistics;
  const rows: [string, string][] = [
    ["Sheet area", formatArea(st.sheetArea)],
    ["Panel area", formatArea(st.placedPanelArea)],
    ["Used area", `${st.utilisationPercent.toFixed(1)}%`],
    ["Wasted area", `${st.wastePercent.toFixed(1)}%`],
    ["Cuts", String(st.cutCount)],
    ["Cut length", formatMmPlain(st.cutLength)],
    ["Panels", String(st.panelCount)],
    ["Reusable surplus", formatArea(st.reusedSurplusArea)],
    ["Scrap", formatArea(st.scrapArea)],
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-bold text-gray-900 mb-3">
        Sheet {sheet.sheetIndex + 1}: {sheet.label}
      </h3>
      <div className="text-sm text-gray-500 mb-3">
        {formatMm(sheet.width, unit)} × {formatMm(sheet.length, unit)}
        {sheet.material ? ` · ${sheet.material}` : ""}
        {sheet.thickness ? ` ${sheet.thickness}mm` : ""}
      </div>
      <div className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-gray-100 py-1">
            <span className="text-gray-500">{k}</span>
            <span className="font-medium text-gray-900">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Panels on this sheet</h4>
        <div className="space-y-1">
          {sheet.placements.map((p, i) => (
            <div
              key={p.panelInstanceId}
              className={`text-sm px-2 py-1 rounded cursor-pointer transition-colors ${
                i % 2 === 0 ? "bg-gray-50" : ""
              }`}
            >
              {p.displayLabel} — {formatMmPlain(p.width)} × {formatMmPlain(p.length)}
              {p.rotated ? " (rotated)" : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CutTable({ sheet }: { sheet: OptimizationResult["sheets"][number] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-bold text-gray-900 mb-3">Cut sequence</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Dir</th>
              <th className="py-2 pr-2">Position</th>
              <th className="py-2 pr-2">Length</th>
            </tr>
          </thead>
          <tbody>
            {sheet.cuts.map((c) => (
              <tr key={c.number} className="border-b border-gray-50">
                <td className="py-1.5 pr-2 font-medium">{c.number}</td>
                <td className="py-1.5 pr-2 text-gray-600">
                  {c.direction === "vertical" ? "Vertical" : "Horizontal"}
                </td>
                <td className="py-1.5 pr-2 text-gray-600">{formatMmPlain(c.cutPosition)}</td>
                <td className="py-1.5 pr-2 text-gray-600">{formatMmPlain(c.cutLength)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "green" | "blue" | "gray";
}) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[accent]}`}>
      <div className="text-xs opacity-75">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}
