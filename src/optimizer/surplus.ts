import type { CutNode, Region, SurplusPiece } from "@/domain/result";

export type SurplusClassification = {
  surplus: SurplusPiece[];
  reusableArea: number;
  scrapArea: number;
};

export const classifySurplus = (
  tree: CutNode,
  sheetId: string,
  sheetIndex: number,
  material: string | undefined,
  thickness: number | undefined,
  minWidth: number,
  minLength: number,
): SurplusClassification => {
  const pieces: SurplusPiece[] = [];
  let reusableArea = 0;
  let scrapArea = 0;
  let surCounter = 1;

  const leaves = collectEmptyLeaves(tree);

  for (const leaf of leaves) {
    const r = leaf.region;
    const area = r.width * r.height;
    const reusable = isReusable(r.width, r.height, minWidth, minLength);

    if (reusable) {
      reusableArea += area;
    } else {
      scrapArea += area;
    }

    const id = `SUR-${String(sheetIndex + 1).padStart(2, "0")}-${String(surCounter).padStart(2, "0")}`;
    surCounter++;

    const suggestedLabel = `SUR: ${Math.round(r.width)}×${Math.round(r.height)} mm`;
    pieces.push({
      id,
      sheetId,
      x: r.x,
      y: r.y,
      width: r.width,
      length: r.height,
      area,
      reusable,
      reason: reusable ? "Reusable" : "Scrap",
      material,
      thickness,
      suggestedLabel,
    });
  }

  pieces.sort((a, b) => {
    if (a.reusable !== b.reusable) return a.reusable ? -1 : 1;
    return b.area - a.area;
  });

  return { surplus: pieces, reusableArea, scrapArea };
};

const isReusable = (
  width: number,
  height: number,
  minWidth: number,
  minLength: number,
): boolean => {
  const orient1 =
    width >= minWidth && height >= minLength;
  const orient2 =
    width >= minLength && height >= minWidth;
  return orient1 || orient2;
};

type EmptyLeaf = { region: Region };

const collectEmptyLeaves = (
  node: CutNode,
): EmptyLeaf[] => {
  if (node.type === "empty") return [{ region: node.region }];
  if (node.type === "split") {
    return [
      ...collectEmptyLeaves(node.first),
      ...collectEmptyLeaves(node.second),
    ];
  }
  return [];
};
