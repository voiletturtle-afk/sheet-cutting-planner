import type { OptimizationResult } from "@/domain/result";
import type { Project } from "@/domain/project";

export type OptimizeStatus = "idle" | "running" | "done" | "error";

export type OptimizeState = {
  status: OptimizeStatus;
  result?: OptimizationResult;
  error?: string;
};

export const optimizeInline = async (
  project: Project,
): Promise<OptimizationResult> => {
  const { optimize } = await import("./optimizer.worker");
  return optimize(project);
};
