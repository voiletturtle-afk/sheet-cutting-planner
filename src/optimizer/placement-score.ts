import type { CutNode, Region } from "@/domain/result";

const EPS = 1e-6;

export type SplitResult = {
  tree: CutNode;
  score: [number, number, number, number, number];
};

const makePanelNode = (
  region: Region,
  panelInstanceId: string,
): CutNode => ({
  type: "panel",
  region,
  panelInstanceId,
});

const makeEmptyNode = (region: Region): CutNode => ({
  type: "empty",
  region,
});

/**
 * Build a split tree for placing a panel of size pw x pl into a leaf region.
 * Tests vertical-first and horizontal-first splits, returns the best.
 */
export const buildPlacementTree = (
  leafRegion: Region,
  panelInstanceId: string,
  pw: number,
  pl: number,
  kerf: number,
): SplitResult | null => {
  if (
    pw > leafRegion.width + EPS ||
    pl > leafRegion.height + EPS
  ) {
    return null;
  }

  const px = leafRegion.x;
  const py = leafRegion.y;

  const verticalFirst = buildVerticalFirst(
    leafRegion,
    panelInstanceId,
    px,
    py,
    pw,
    pl,
    kerf,
  );
  const horizontalFirst = buildHorizontalFirst(
    leafRegion,
    panelInstanceId,
    px,
    py,
    pw,
    pl,
    kerf,
  );

  const candidates: SplitResult[] = [];
  if (verticalFirst) candidates.push(verticalFirst);
  if (horizontalFirst) candidates.push(horizontalFirst);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    for (let i = 0; i < a.score.length; i++) {
      const d = a.score[i] - b.score[i];
      if (Math.abs(d) > EPS) return d;
    }
    return 0;
  });
  return candidates[0];
};

/**
 * Vertical-first: cut at x = px + pw, separating [panel | remainder].
 * Panel region is then split horizontally at y = py + pl.
 */
const buildVerticalFirst = (
  leaf: Region,
  panelInstanceId: string,
  px: number,
  py: number,
  pw: number,
  pl: number,
  kerf: number,
): SplitResult | null => {
  const panelRegion: Region = { x: px, y: py, width: pw, height: pl };
  const remainderX = px + pw + kerf;
  const remainderWidth = leaf.width - pw - kerf;

  if (remainderWidth < -EPS) return null;

  const panelNode = makePanelNode(panelRegion, panelInstanceId);

  // Split panel region horizontally at py + pl to separate panel from scrap below
  const panelSubSplit: CutNode =
    pl + EPS < leaf.height
      ? {
          type: "split",
          region: { x: px, y: py, width: pw, height: leaf.height },
          direction: "horizontal",
          cutPosition: py + pl + kerf,
          kerf,
          first: panelNode,
          second: makeEmptyNode({
            x: px,
            y: py + pl + kerf,
            width: pw,
            height: leaf.height - pl - kerf,
          }),
        }
      : panelNode;

  if (remainderWidth <= EPS) {
    return {
      tree: panelSubSplit,
      score: scoreTree(leaf, panelSubSplit, pw, pl, kerf),
    };
  }

  const tree: CutNode = {
    type: "split",
    region: leaf,
    direction: "vertical",
    cutPosition: px + pw + kerf,
    kerf,
    first: panelSubSplit,
    second: makeEmptyNode({
      x: remainderX,
      y: py,
      width: remainderWidth,
      height: leaf.height,
    }),
  };

  return { tree, score: scoreTree(leaf, tree, pw, pl, kerf) };
};

/**
 * Horizontal-first: cut at y = py + pl, separating [panel | remainder].
 * Panel region is then split vertically at x = px + pw.
 */
const buildHorizontalFirst = (
  leaf: Region,
  panelInstanceId: string,
  px: number,
  py: number,
  pw: number,
  pl: number,
  kerf: number,
): SplitResult | null => {
  const panelRegion: Region = { x: px, y: py, width: pw, height: pl };
  const remainderY = py + pl + kerf;
  const remainderHeight = leaf.height - pl - kerf;

  if (remainderHeight < -EPS) return null;

  const panelNode = makePanelNode(panelRegion, panelInstanceId);

  const panelSubSplit: CutNode =
    pw + EPS < leaf.width
      ? {
          type: "split",
          region: { x: px, y: py, width: leaf.width, height: pl },
          direction: "vertical",
          cutPosition: px + pw + kerf,
          kerf,
          first: panelNode,
          second: makeEmptyNode({
            x: px + pw + kerf,
            y: py,
            width: leaf.width - pw - kerf,
            height: pl,
          }),
        }
      : panelNode;

  if (remainderHeight <= EPS) {
    return {
      tree: panelSubSplit,
      score: scoreTree(leaf, panelSubSplit, pw, pl, kerf),
    };
  }

  const tree: CutNode = {
    type: "split",
    region: leaf,
    direction: "horizontal",
    cutPosition: py + pl + kerf,
    kerf,
    first: panelSubSplit,
    second: makeEmptyNode({
      x: px,
      y: remainderY,
      width: leaf.width,
      height: remainderHeight,
    }),
  };

  return { tree, score: scoreTree(leaf, tree, pw, pl, kerf) };
};

/**
 * Score: [newSheetPenalty, shortSideWaste, remainingArea, tinyScrapCount, sheetIndex]
 */
const scoreTree = (
  leaf: Region,
  tree: CutNode,
  pw: number,
  pl: number,
  kerf: number,
): [number, number, number, number, number] => {
  const usedArea = pw * pl;
  const leafArea = leaf.width * leaf.height;
  const remainingArea = leafArea - usedArea;
  const shortSideWaste = Math.min(leaf.width - pw, leaf.height - pl);
  const tinyScrapCount = countTinyScrap(tree, kerf);
  return [0, shortSideWaste, remainingArea, tinyScrapCount, 0];
};

const countTinyScrap = (
  node: CutNode,
  kerf: number,
  tinyThreshold = 50,
): number => {
  if (node.type === "empty") {
    if (node.region.width < tinyThreshold || node.region.height < tinyThreshold) {
      return 1;
    }
    return 0;
  }
  if (node.type === "split") {
    return (
      countTinyScrap(node.first, kerf, tinyThreshold) +
      countTinyScrap(node.second, kerf, tinyThreshold)
    );
  }
  return 0;
};

export const createEmptySheet = (width: number, length: number): CutNode => ({
  type: "empty",
  region: { x: 0, y: 0, width, height: length },
});
