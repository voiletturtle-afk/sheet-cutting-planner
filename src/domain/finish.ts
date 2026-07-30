export type Edge = "top" | "right" | "bottom" | "left";

export type FinishType = "none" | "full-teak" | "selected-edges" | "custom";

export type PanelFinish = {
  type: FinishType;
  teakEdges: Edge[];
  note?: string;
};

export const createEmptyFinish = (): PanelFinish => ({
  type: "none",
  teakEdges: [],
});
