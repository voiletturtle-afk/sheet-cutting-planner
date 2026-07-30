import type { Project } from "@/domain/project";
import type { OptimizationResult } from "@/domain/result";

const DRAFT_KEY = "cutplan:draft";

export type DraftState = {
  project: Project;
  result?: {
    inputHash: string;
    generatedAt: string;
    result: OptimizationResult;
  };
};

export const saveDraft = (state: DraftState): void => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    // storage may be full or unavailable; ignore silently
  }
};

export const loadDraft = (): DraftState | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed.project) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearDraft = (): void => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
};
