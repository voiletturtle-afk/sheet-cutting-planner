import type { CutNode, Region } from "@/domain/result";

export type PathStep = "first" | "second";
export type TreePath = PathStep[];

export type EmptyLeaf = {
  region: Region;
  path: TreePath;
};

export const collectEmptyLeaves = (
  node: CutNode,
  path: TreePath = [],
): EmptyLeaf[] => {
  if (node.type === "empty") {
    return [{ region: node.region, path }];
  }
  if (node.type === "split") {
    return [
      ...collectEmptyLeaves(node.first, [...path, "first"]),
      ...collectEmptyLeaves(node.second, [...path, "second"]),
    ];
  }
  return [];
};

export const replaceAtPath = (
  node: CutNode,
  path: TreePath,
  replacement: CutNode,
): CutNode => {
  if (path.length === 0) return replacement;
  if (node.type !== "split") return replacement;
  const [head, ...rest] = path;
  if (head === "first") {
    return { ...node, first: replaceAtPath(node.first, rest, replacement) };
  }
  return { ...node, second: replaceAtPath(node.second, rest, replacement) };
};

export type KerfStrip = {
  region: Region;
  direction: "horizontal" | "vertical";
};

export const collectKerfStrips = (node: CutNode): KerfStrip[] => {
  if (node.type !== "split") return [];
  const strips: KerfStrip[] = [];
  if (node.direction === "vertical") {
    strips.push({
      region: {
        x: node.cutPosition,
        y: node.region.y,
        width: node.kerf,
        height: node.region.height,
      },
      direction: "vertical",
    });
  } else {
    strips.push({
      region: {
        x: node.region.x,
        y: node.cutPosition,
        width: node.region.width,
        height: node.kerf,
      },
      direction: "horizontal",
    });
  }
  return [...strips, ...collectKerfStrips(node.first), ...collectKerfStrips(node.second)];
};

export const collectPanelRegions = (
  node: CutNode,
): { region: Region; panelInstanceId: string }[] => {
  if (node.type === "panel") {
    return [{ region: node.region, panelInstanceId: node.panelInstanceId }];
  }
  if (node.type === "split") {
    return [...collectPanelRegions(node.first), ...collectPanelRegions(node.second)];
  }
  return [];
};

export const countCuts = (node: CutNode): number => {
  if (node.type !== "split") return 0;
  return 1 + countCuts(node.first) + countCuts(node.second);
};
