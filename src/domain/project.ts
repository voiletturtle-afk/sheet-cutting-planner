import type { StockSheet } from "./stock-sheet";
import type { Panel } from "./panel";

export type MeasurementUnit = "mm" | "cm" | "m" | "in";

export type ProjectSettings = {
  kerf: number;
  allowRotation: boolean;
  minimumSurplusWidth: number;
  minimumSurplusLength: number;
};

export type Project = {
  id: string;
  name: string;
  unit: MeasurementUnit;
  settings: ProjectSettings;
  stockSheets: StockSheet[];
  panels: Panel[];
};

export const createDefaultProject = (): Project => ({
  id: "proj-" + Date.now().toString(36),
  name: "Untitled project",
  unit: "mm",
  settings: {
    kerf: 3,
    allowRotation: true,
    minimumSurplusWidth: 100,
    minimumSurplusLength: 300,
  },
  stockSheets: [],
  panels: [],
});
