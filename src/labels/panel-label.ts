import type { Panel } from "@/domain/panel";
import type { Edge, PanelFinish } from "@/domain/finish";

const EDGE_LABELS: Record<Edge, string> = {
  top: "T",
  right: "R",
  bottom: "B",
  left: "L",
};

const EDGE_ORDER: Edge[] = ["top", "right", "bottom", "left"];

export const generateFinishLabel = (finish: PanelFinish): string => {
  if (finish.type === "custom" && finish.note) {
    return finish.note;
  }
  if (finish.type === "none" || finish.teakEdges.length === 0) {
    return "no teak";
  }
  const allSelected = finish.teakEdges.length === 4;
  if (finish.type === "full-teak" || allSelected) {
    return "full teak";
  }
  const count = finish.teakEdges.length;
  const edges = EDGE_ORDER.filter((e) => finish.teakEdges.includes(e));
  const edgeStr = edges.map((e) => EDGE_LABELS[e]).join(" + ");
  if (count === 1) {
    return `1 side teak (${edgeStr})`;
  }
  return `${count} side teak (${edgeStr})`;
};

export const generateDisplayLabel = (panel: Panel): string => {
  if (panel.labelOverride && panel.labelOverride.trim()) {
    return panel.labelOverride.trim();
  }
  const finish = generateFinishLabel(panel.finish);
  return finish ? `${panel.name} / ${finish}` : panel.name;
};

export const buildPanelLabels = (
  panels: Panel[],
): Map<string, { display: string; finish: string }> => {
  const map = new Map<string, { display: string; finish: string }>();
  for (const panel of panels) {
    map.set(panel.id, {
      display: generateDisplayLabel(panel),
      finish: generateFinishLabel(panel.finish),
    });
  }
  return map;
};
