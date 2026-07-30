import type { CutNode, CutInstruction, Region } from "@/domain/result";

export const buildCutSequence = (
  tree: CutNode,
  sheetId: string,
): CutInstruction[] => {
  const cuts: CutInstruction[] = [];
  let counter = 1;

  const traverse = (node: CutNode): void => {
    if (node.type !== "split") return;
    const direction = node.direction;
    const sourceRegion = node.region;
    const cutPosition = node.cutPosition;
    const cutLength =
      direction === "vertical" ? sourceRegion.height : sourceRegion.width;

    const resultLabel = describeSplit(node);

    cuts.push({
      number: counter++,
      direction,
      sourceRegion,
      cutPosition,
      cutLength,
      resultLabel,
    });

    traverse(node.first);
    traverse(node.second);
  };

  traverse(tree);
  return cuts;
};

const describeSplit = (node: Extract<CutNode, { type: "split" }>): string => {
  if (node.first.type === "panel") {
    return `Panel ${node.first.panelInstanceId}`;
  }
  if (node.second.type === "panel") {
    return `Panel ${node.second.panelInstanceId}`;
  }
  if (node.first.type === "split" && node.first.first.type === "panel") {
    return `Panel ${node.first.first.panelInstanceId}`;
  }
  return node.direction === "vertical" ? "Vertical split" : "Horizontal split";
};

export const totalCutLength = (cuts: CutInstruction[]): number =>
  cuts.reduce((sum, c) => sum + c.cutLength, 0);
