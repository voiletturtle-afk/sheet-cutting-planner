import { useState, useRef } from "react";
import { Plus, Trash2, Download, Upload, Copy, Settings } from "lucide-react";
import type { Project } from "@/domain/project";
import type { MeasurementUnit } from "@/domain/project";
import type { StockSheet } from "@/domain/stock-sheet";
import type { Panel } from "@/domain/panel";
import type { Edge, FinishType } from "@/domain/finish";
import type { OptimizationResult } from "@/domain/result";
import { createStockSheet } from "@/domain/stock-sheet";
import { createPanel } from "@/domain/panel";
import { convertToMm, formatMm, UNIT_CONVERSIONS } from "@/calculations/units";
import {
  totalAvailableStockArea,
  totalRequiredPanelArea,
  theoreticalDifference,
  totalPanelInstances,
} from "@/calculations/areas";
import { validateProject, canRunOptimization } from "@/calculations/validation";
import {
  generateDisplayLabel,
  generateFinishLabel,
} from "@/labels/panel-label";
import {
  serializeProjectJson,
  deserializeProject,
  buildFilename,
  computeProjectHash,
} from "@/storage/project-file";

type Props = {
  project: Project;
  result?: OptimizationResult;
  onProjectChange: (p: Project) => void;
  onRunOptimization: () => void;
  optimizing: boolean;
};

const EDGE_OPTIONS: { value: Edge; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "right", label: "Right" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
];

export function ProjectEditor({
  project,
  result,
  onProjectChange,
  onRunOptimization,
  optimizing,
}: Props) {
  const [activeTab, setActiveTab] = useState<"settings" | "sheets" | "panels">("settings");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const warnings = validateProject(project);
  const canRun = canRunOptimization(warnings);

  const handleExport = () => {
    const savedResult = result
      ? {
          inputHash: computeProjectHash(project),
          generatedAt: new Date().toISOString(),
          result,
        }
      : undefined;
    const json = serializeProjectJson(project, savedResult);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFilename(project, "json");
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const saved = deserializeProject(reader.result as string);
      if (saved) {
        onProjectChange(saved.project);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <ToolbarButton onClick={() => fileInputRef.current?.click()} icon={<Upload className="w-4 h-4" />}>
            Import
          </ToolbarButton>
          <ToolbarButton onClick={handleExport} icon={<Download className="w-4 h-4" />}>
            Export
          </ToolbarButton>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>
          <Settings className="w-4 h-4 inline mr-1" /> Settings
        </TabButton>
        <TabButton active={activeTab === "sheets"} onClick={() => setActiveTab("sheets")}>
          Stock Sheets ({project.stockSheets.length})
        </TabButton>
        <TabButton active={activeTab === "panels"} onClick={() => setActiveTab("panels")}>
          Panels ({project.panels.length})
        </TabButton>
      </div>

      {activeTab === "settings" && (
        <SettingsTab project={project} onChange={onProjectChange} />
      )}
      {activeTab === "sheets" && (
        <SheetsTab project={project} onChange={onProjectChange} />
      )}
      {activeTab === "panels" && (
        <PanelsTab project={project} onChange={onProjectChange} />
      )}

      {warnings.length > 0 && (
        <div className="mt-6 space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`px-4 py-2 rounded-lg text-sm ${
                w.level === "error"
                  ? "bg-red-50 text-red-700"
                  : w.level === "warning"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-blue-50 text-blue-700"
              }`}
            >
              {w.message}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={onRunOptimization}
          disabled={!canRun || optimizing}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {optimizing ? "Optimizing..." : "Run Optimization"}
        </button>
        <EstimateSummary project={project} />
      </div>
    </div>
  );
}

function SettingsTab({
  project,
  onChange,
}: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const update = (patch: Partial<Project>) => onChange({ ...project, ...patch });
  const updateSettings = (patch: Partial<Project["settings"]>) =>
    onChange({ ...project, settings: { ...project.settings, ...patch } });

  const convertInputToMm = (value: number, unit: MeasurementUnit): number =>
    convertToMm(value, unit);

  return (
    <div className="space-y-6 max-w-2xl">
      <Field label="Project name">
        <input
          type="text"
          value={project.name}
          onChange={(e) => update({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </Field>

      <Field label="Measurement unit">
        <select
          value={project.unit}
          onChange={(e) => update({ unit: e.target.value as MeasurementUnit })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="mm">Millimetres (mm)</option>
          <option value="cm">Centimetres (cm)</option>
          <option value="m">Metres (m)</option>
          <option value="in">Inches (in)</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={`Kerf thickness (${project.unit})`}>
          <input
            type="number"
            value={project.settings.kerf / UNIT_CONVERSIONS[project.unit].toMm}
            onChange={(e) =>
              updateSettings({
                kerf: convertInputToMm(Number(e.target.value), project.unit),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </Field>
        <Field label="Allow rotation">
          <select
            value={project.settings.allowRotation ? "yes" : "no"}
            onChange={(e) =>
              updateSettings({ allowRotation: e.target.value === "yes" })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={`Min reusable width (${project.unit})`}>
          <input
            type="number"
            value={project.settings.minimumSurplusWidth / UNIT_CONVERSIONS[project.unit].toMm}
            onChange={(e) =>
              updateSettings({
                minimumSurplusWidth: convertInputToMm(Number(e.target.value), project.unit),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </Field>
        <Field label={`Min reusable length (${project.unit})`}>
          <input
            type="number"
            value={project.settings.minimumSurplusLength / UNIT_CONVERSIONS[project.unit].toMm}
            onChange={(e) =>
              updateSettings({
                minimumSurplusLength: convertInputToMm(Number(e.target.value), project.unit),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </Field>
      </div>
    </div>
  );
}

function SheetsTab({
  project,
  onChange,
}: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const addSheet = () => {
    const id = `sheet-${Date.now().toString(36)}`;
    onChange({
      ...project,
      stockSheets: [...project.stockSheets, createStockSheet(id)],
    });
  };

  const updateSheet = (id: string, patch: Partial<StockSheet>) =>
    onChange({
      ...project,
      stockSheets: project.stockSheets.map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    });

  const removeSheet = (id: string) =>
    onChange({
      ...project,
      stockSheets: project.stockSheets.filter((s) => s.id !== id),
    });

  return (
    <div className="space-y-4">
      {project.stockSheets.map((sheet) => (
        <div key={sheet.id} className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <input
              type="text"
              value={sheet.label}
              onChange={(e) => updateSheet(sheet.id, { label: e.target.value })}
              placeholder="Sheet label"
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            />
            <button
              onClick={() => removeSheet(sheet.id)}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label={`Width (${project.unit})`}>
              <input
                type="number"
                value={sheet.width / UNIT_CONVERSIONS[project.unit].toMm}
                onChange={(e) =>
                  updateSheet(sheet.id, {
                    width: convertToMm(Number(e.target.value), project.unit),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </Field>
            <Field label={`Length (${project.unit})`}>
              <input
                type="number"
                value={sheet.length / UNIT_CONVERSIONS[project.unit].toMm}
                onChange={(e) =>
                  updateSheet(sheet.id, {
                    length: convertToMm(Number(e.target.value), project.unit),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                value={sheet.quantity}
                onChange={(e) =>
                  updateSheet(sheet.id, { quantity: Math.max(1, Number(e.target.value)) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </Field>
            <Field label="Thickness (mm)">
              <input
                type="number"
                value={sheet.thickness ?? ""}
                onChange={(e) =>
                  updateSheet(sheet.id, { thickness: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Material">
              <input
                type="text"
                value={sheet.material ?? ""}
                onChange={(e) => updateSheet(sheet.id, { material: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </Field>
          </div>
        </div>
      ))}
      <button
        onClick={addSheet}
        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add stock sheet
      </button>
    </div>
  );
}

function PanelsTab({
  project,
  onChange,
}: {
  project: Project;
  onChange: (p: Project) => void;
}) {
  const addPanel = () => {
    const id = `panel-${Date.now().toString(36)}`;
    onChange({ ...project, panels: [...project.panels, createPanel(id)] });
  };

  const updatePanel = (id: string, patch: Partial<Panel>) =>
    onChange({
      ...project,
      panels: project.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const removePanel = (id: string) =>
    onChange({
      ...project,
      panels: project.panels.filter((p) => p.id !== id),
    });

  return (
    <div className="space-y-4">
      {project.panels.map((panel) => {
        const displayLabel = generateDisplayLabel(panel);
        return (
          <div key={panel.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={panel.name}
                  onChange={(e) => updatePanel(panel.id, { name: e.target.value })}
                  placeholder="Panel name"
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
              </div>
              <button
                onClick={() => removePanel(panel.id)}
                className="text-red-500 hover:text-red-700 p-1 ml-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <Field label={`Width (${project.unit})`}>
                <input
                  type="number"
                  value={panel.width / UNIT_CONVERSIONS[project.unit].toMm}
                  onChange={(e) =>
                    updatePanel(panel.id, {
                      width: convertToMm(Number(e.target.value), project.unit),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </Field>
              <Field label={`Length (${project.unit})`}>
                <input
                  type="number"
                  value={panel.length / UNIT_CONVERSIONS[project.unit].toMm}
                  onChange={(e) =>
                    updatePanel(panel.id, {
                      length: convertToMm(Number(e.target.value), project.unit),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </Field>
              <Field label="Quantity">
                <input
                  type="number"
                  min={1}
                  value={panel.quantity}
                  onChange={(e) =>
                    updatePanel(panel.id, { quantity: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </Field>
            </div>

            <div className="mb-3">
              <Field label="Allow rotation">
                <select
                  value={panel.allowRotation ? "yes" : "no"}
                  onChange={(e) =>
                    updatePanel(panel.id, { allowRotation: e.target.value === "yes" })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>

            <div className="mb-3">
              <Field label="Finish type">
                <select
                  value={panel.finish.type}
                  onChange={(e) =>
                    updatePanel(panel.id, {
                      finish: {
                        ...panel.finish,
                        type: e.target.value as FinishType,
                        teakEdges:
                          e.target.value === "full-teak"
                            ? ["top", "right", "bottom", "left"]
                            : e.target.value === "none"
                              ? []
                              : panel.finish.teakEdges,
                      },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="none">No teak</option>
                  <option value="full-teak">Full teak (all edges)</option>
                  <option value="selected-edges">Selected edges</option>
                  <option value="custom">Custom instruction</option>
                </select>
              </Field>
            </div>

            {panel.finish.type === "selected-edges" && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Teak edges</label>
                <div className="flex gap-2">
                  {EDGE_OPTIONS.map((edge) => {
                    const active = panel.finish.teakEdges.includes(edge.value);
                    return (
                      <button
                        key={edge.value}
                        onClick={() =>
                          updatePanel(panel.id, {
                            finish: {
                              ...panel.finish,
                              teakEdges: active
                                ? panel.finish.teakEdges.filter((e) => e !== edge.value)
                                : [...panel.finish.teakEdges, edge.value],
                            },
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          active
                            ? "bg-amber-100 border-amber-400 text-amber-800"
                            : "bg-white border-gray-300 text-gray-600"
                        }`}
                      >
                        {edge.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {panel.finish.type === "custom" && (
              <div className="mb-3">
                <Field label="Custom instruction">
                  <input
                    type="text"
                    value={panel.finish.note ?? ""}
                    onChange={(e) =>
                      updatePanel(panel.id, {
                        finish: { ...panel.finish, note: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </Field>
              </div>
            )}

            <div className="mb-3">
              <Field label="Label override (optional)">
                <input
                  type="text"
                  value={panel.labelOverride ?? ""}
                  onChange={(e) =>
                    updatePanel(panel.id, { labelOverride: e.target.value })
                  }
                  placeholder="Leave empty to auto-generate"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </Field>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Preview:</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                {displayLabel}
              </span>
            </div>
          </div>
        );
      })}
      <button
        onClick={addPanel}
        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Add panel
      </button>
    </div>
  );
}

function EstimateSummary({ project }: { project: Project }) {
  const available = totalAvailableStockArea(project);
  const required = totalRequiredPanelArea(project);
  const diff = theoreticalDifference(project);
  const instances = totalPanelInstances(project);

  return (
    <div className="text-sm text-gray-600">
      <span className="font-medium">{project.stockSheets.length} sheet types</span>
      {" · "}
      <span>{instances} panel instances</span>
      {" · "}
      <span className={diff >= 0 ? "text-green-600" : "text-red-600"}>
        Theoretical {diff >= 0 ? "surplus" : "shortfall"}: {formatMm(Math.abs(diff), "mm")}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
    >
      {icon}
      {children}
    </button>
  );
}
