import type { PanelFinish } from "./finish";

export type Panel = {
  id: string;
  name: string;
  width: number;
  length: number;
  quantity: number;
  allowRotation: boolean;
  finish: PanelFinish;
  labelOverride?: string;
};

export type PanelInstance = {
  instanceId: string;
  panelId: string;
  name: string;
  width: number;
  length: number;
  allowRotation: boolean;
  displayLabel: string;
  finishLabel: string;
};

export const createPanel = (id: string): Panel => ({
  id,
  name: "",
  width: 0,
  length: 0,
  quantity: 1,
  allowRotation: true,
  finish: { type: "none", teakEdges: [] },
});
