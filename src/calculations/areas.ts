import type { Project } from "@/domain/project";
import type { Panel } from "@/domain/panel";
import type { StockSheet } from "@/domain/stock-sheet";
import type { PanelInstance } from "@/domain/panel";

export const sheetArea = (sheet: StockSheet): number =>
  sheet.width * sheet.length;

export const panelArea = (panel: Panel): number => panel.width * panel.length;

export const totalAvailableStockArea = (project: Project): number =>
  project.stockSheets.reduce(
    (sum, s) => sum + sheetArea(s) * s.quantity,
    0,
  );

export const totalRequiredPanelArea = (project: Project): number =>
  project.panels.reduce(
    (sum, p) => sum + panelArea(p) * p.quantity,
    0,
  );

export const theoreticalDifference = (project: Project): number =>
  totalAvailableStockArea(project) - totalRequiredPanelArea(project);

export const expandPanelInstances = (
  project: Project,
  labels: Map<string, { display: string; finish: string }>,
): PanelInstance[] => {
  const instances: PanelInstance[] = [];
  for (const panel of project.panels) {
    const lbl = labels.get(panel.id) ?? { display: panel.name, finish: "" };
    for (let i = 0; i < panel.quantity; i++) {
      instances.push({
        instanceId: `${panel.id}#${i + 1}`,
        panelId: panel.id,
        name: panel.name,
        width: panel.width,
        length: panel.length,
        allowRotation: panel.allowRotation && project.settings.allowRotation,
        displayLabel: lbl.display,
        finishLabel: lbl.finish,
      });
    }
  }
  return instances;
};

export const totalPanelInstances = (project: Project): number =>
  project.panels.reduce((sum, p) => sum + p.quantity, 0);
