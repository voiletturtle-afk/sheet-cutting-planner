import type { Project } from "@/domain/project";
import type { Panel } from "@/domain/panel";

export type ValidationWarning = {
  level: "error" | "warning" | "info";
  message: string;
};

export const validateProject = (project: Project): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];

  if (!project.name.trim()) {
    warnings.push({ level: "error", message: "Project name is required." });
  }

  if (project.settings.kerf < 0) {
    warnings.push({ level: "error", message: "Kerf thickness cannot be negative." });
  }

  if (project.stockSheets.length === 0) {
    warnings.push({ level: "error", message: "At least one stock sheet is required." });
  }

  for (const sheet of project.stockSheets) {
    if (sheet.width <= 0 || sheet.length <= 0) {
      warnings.push({
        level: "error",
        message: `Stock sheet "${sheet.label || "Untitled"}" has invalid dimensions.`,
      });
    }
    if (sheet.quantity <= 0) {
      warnings.push({
        level: "error",
        message: `Stock sheet "${sheet.label || "Untitled"}" quantity must be at least 1.`,
      });
    }
  }

  if (project.panels.length === 0) {
    warnings.push({ level: "error", message: "At least one panel is required." });
  }

  const maxSheetWidth = Math.max(0, ...project.stockSheets.map((s) => s.width));
  const maxSheetLength = Math.max(0, ...project.stockSheets.map((s) => s.length));

  for (const panel of project.panels) {
    if (!panel.name.trim()) {
      warnings.push({ level: "error", message: "Every panel needs a name." });
    }
    if (panel.width <= 0 || panel.length <= 0) {
      warnings.push({
        level: "error",
        message: `Panel "${panel.name || "Untitled"}" has invalid dimensions.`,
      });
      continue;
    }
    if (panel.quantity <= 0) {
      warnings.push({
        level: "error",
        message: `Panel "${panel.name}" quantity must be at least 1.`,
      });
    }

    const fitsNormal = panel.width <= maxSheetWidth && panel.length <= maxSheetLength;
    const fitsRotated =
      panel.allowRotation &&
      project.settings.allowRotation &&
      panel.length <= maxSheetWidth &&
      panel.width <= maxSheetLength;

    if (!fitsNormal && !fitsRotated) {
      warnings.push({
        level: "warning",
        message: `Panel "${panel.name}" (${panel.width}×${panel.length} mm) cannot fit any stock sheet.`,
      });
    } else if (!fitsNormal && fitsRotated) {
      warnings.push({
        level: "info",
        message: `Panel "${panel.name}" only fits when rotated.`,
      });
    }
  }

  return warnings;
};

export const canRunOptimization = (
  warnings: ValidationWarning[],
): boolean => !warnings.some((w) => w.level === "error");
