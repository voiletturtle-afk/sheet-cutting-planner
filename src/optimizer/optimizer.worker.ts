import type { Project } from "@/domain/project";
import type { OptimizationResult } from "@/domain/result";
import { expandPanelInstances } from "@/calculations/areas";
import { buildPanelLabels } from "@/labels/panel-label";
import { runOptimization } from "./guillotine";

export type OptimizeRequest = {
  project: Project;
};

export type OptimizeResponse = {
  result: OptimizationResult;
};

export const optimize = (project: Project): OptimizationResult => {
  const labels = buildPanelLabels(project.panels);
  const instances = expandPanelInstances(project, labels);
  return runOptimization(project, instances);
};
