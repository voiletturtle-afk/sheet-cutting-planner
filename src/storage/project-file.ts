import type { Project } from "@/domain/project";
import type { OptimizationResult } from "@/domain/result";

const SCHEMA_VERSION = 1;

export type SavedProject = {
  schemaVersion: number;
  project: Project;
  savedResult?: {
    inputHash: string;
    generatedAt: string;
    result: OptimizationResult;
  };
};

export const computeProjectHash = (project: Project): string => {
  const canonical = JSON.stringify({
    settings: project.settings,
    stockSheets: project.stockSheets,
    panels: project.panels,
  });
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash + canonical.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
};

export const serializeProject = (
  project: Project,
  savedResult?: SavedProject["savedResult"],
): SavedProject => ({
  schemaVersion: SCHEMA_VERSION,
  project,
  savedResult,
});

export const serializeProjectJson = (
  project: Project,
  savedResult?: SavedProject["savedResult"],
): string => JSON.stringify(serializeProject(project, savedResult), null, 2);

export const deserializeProject = (
  json: string,
): SavedProject | null => {
  try {
    const parsed = JSON.parse(json) as SavedProject;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return null;
    }
    if (!parsed.project) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const isResultStale = (
  saved: SavedProject,
  currentHash: string,
): boolean => saved.savedResult?.inputHash !== currentHash;

export const buildFilename = (project: Project, extension: string): string => {
  const slug = (project.name || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "untitled";
  return `${slug}.cutplan.${extension}`;
};
