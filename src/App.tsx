import { useState, useEffect, useCallback, useRef } from "react";
import type { Project } from "@/domain/project";
import type { OptimizationResult } from "@/domain/result";
import { createDefaultProject } from "@/domain/project";
import { validateProject, canRunOptimization } from "@/calculations/validation";
import { buildPanelLabels } from "@/labels/panel-label";
import { expandPanelInstances } from "@/calculations/areas";
import { runOptimization } from "@/optimizer/guillotine";
import {
  saveDraft,
  loadDraft,
  type DraftState,
} from "@/storage/local-draft";
import {
  computeProjectHash,
  isResultStale,
} from "@/storage/project-file";
import { ProjectEditor } from "@/components/ProjectEditor";
import { ResultsView } from "@/components/ResultsView";

type Route = "#/edit" | "#/results";

export default function App() {
  const [project, setProject] = useState<Project>(() => {
    const draft = loadDraft();
    return draft?.project ?? createDefaultProject();
  });

  const [result, setResult] = useState<OptimizationResult | undefined>(() => {
    const draft = loadDraft();
    return draft?.result?.result;
  });

  const [route, setRoute] = useState<Route>(
    () => (window.location.hash === "#/results" ? "#/results" : "#/edit"),
  );

  const [optimizing, setOptimizing] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Auto-save draft
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const draft: DraftState = {
        project,
        result: result
          ? {
              inputHash: computeProjectHash(project),
              generatedAt: new Date().toISOString(),
              result,
            }
          : undefined,
      };
      saveDraft(draft);
    }, 500);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [project, result]);

  // Hash routing
  useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash === "#/results" ? "#/results" : "#/edit");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const handleProjectChange = useCallback((p: Project) => {
    setProject(p);
    if (result) {
      const newHash = computeProjectHash(p);
      const savedHash = computeProjectHash(project);
      if (newHash !== savedHash) {
        setResult(undefined);
      }
    }
  }, [project, result]);

  const handleRunOptimization = useCallback(() => {
    if (!canRunOptimization(validateProject(project))) return;
    setOptimizing(true);
    // Defer to next tick so UI can update
    setTimeout(() => {
      try {
        const labels = buildPanelLabels(project.panels);
        const instances = expandPanelInstances(project, labels);
        const res = runOptimization(project, instances);
        setResult(res);
        setRoute("#/results");
        window.location.hash = "#/results";
      } catch (err) {
        console.error("Optimization failed", err);
      } finally {
        setOptimizing(false);
      }
    }, 10);
  }, [project]);

  const resultIsStale =
    result !== undefined &&
    (() => {
      const draft = loadDraft();
      if (!draft?.result) return false;
      return isResultStale(
        { schemaVersion: 1, project, savedResult: draft.result },
        computeProjectHash(project),
      );
    })();

  if (route === "#/results" && result) {
    return (
      <ResultsView
        project={project}
        result={result}
        onBack={() => {
          setRoute("#/edit");
          window.location.hash = "#/edit";
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProjectEditor
        project={project}
        result={resultIsStale ? undefined : result}
        onProjectChange={handleProjectChange}
        onRunOptimization={handleRunOptimization}
        optimizing={optimizing}
      />
    </div>
  );
}
