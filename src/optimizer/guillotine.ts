import type { Project } from "@/domain/project";
import type { PanelInstance } from "@/domain/panel";
import type { StockSheet } from "@/domain/stock-sheet";
import type {
  CutNode,
  OptimizationResult,
  Placement,
  SheetResult,
  SheetStatistics,
  ProjectSummary,
  UnplacedPanel,
} from "@/domain/result";
import { buildPlacementTree, createEmptySheet } from "./placement-score";
import { collectEmptyLeaves, replaceAtPath, collectKerfStrips, collectPanelRegions } from "./free-rectangles";
import { buildCutSequence, totalCutLength } from "./cut-sequence";
import { classifySurplus } from "./surplus";
import {
  totalAvailableStockArea,
  totalRequiredPanelArea,
  theoreticalDifference,
  totalPanelInstances,
} from "@/calculations/areas";

type SheetContext = {
  sheet: StockSheet;
  instanceIndex: number;
  tree: CutNode;
};

const EPS = 1e-6;

export const runOptimization = (
  project: Project,
  instances: PanelInstance[],
): OptimizationResult => {
  if (project.stockSheets.length === 0) {
    return runOptimizationWithLimit(project, instances, 0);
  }

  const currentQuantity = availableSheetCount(project);

  const currentResult = runOptimizationWithLimit(
    project,
    instances,
    currentQuantity,
  );

  // Everything fits in the available stock.
  if (currentResult.unplacedPanels.length === 0) {
    return currentResult;
  }

  /*
   * In the worst case, every panel may need its own sheet.
   * This gives the search a safe upper limit.
   */
  const maximumQuantity =
    currentQuantity + currentResult.unplacedPanels.length;

  for (
    let testQuantity = currentQuantity + 1;
    testQuantity <= maximumQuantity;
    testQuantity++
  ) {
    const testResult = runOptimizationWithLimit(
      project,
      instances,
      testQuantity,
    );

    if (testResult.unplacedPanels.length === 0) {
      const stockSheet = project.stockSheets[0];

      return {
        ...currentResult,
        stockRecommendation: {
          stockSheetId: stockSheet.id,
          label: stockSheet.label || "Stock sheet",
          currentQuantity,
          requiredQuantity: testQuantity,
          additionalQuantity: testQuantity - currentQuantity,
        },
      };
    }
  }

  /*
   * No recommendation is returned when a panel cannot physically fit
   * on the selected sheet, regardless of how many sheets are added.
   */
  return currentResult;
};

export const runOptimizationWithLimit  = (
  project: Project,
  instances: PanelInstance[],
  maximumSheetCount: number,
): OptimizationResult => {
  const kerf = project.settings.kerf;
  const minWidth = project.settings.minimumSurplusWidth;
  const minLength = project.settings.minimumSurplusLength;

  const sortedInstances = [...instances].sort((a, b) => {
    const areaA = a.width * a.length;
    const areaB = b.width * b.length;
    if (Math.abs(areaA - areaB) > EPS) return areaB - areaA;
    return Math.max(b.width, b.length) - Math.max(a.width, a.length);
  });

  const sheets: SheetContext[] = [];
  const placements: Placement[] = [];
  const unplaced: UnplacedPanel[] = [];

  let sheetCounter = 0;

  const openNewSheet = (): SheetContext => {
    const sheetSpec = project.stockSheets[0];
    const ctx: SheetContext = {
      sheet: sheetSpec,
      instanceIndex: sheetCounter,
      tree: createEmptySheet(sheetSpec.width, sheetSpec.length),
    };
    sheets.push(ctx);
    sheetCounter++;
    return ctx;
  };

  const instanceById = new Map<string, PanelInstance>();
  for (const inst of instances) instanceById.set(inst.instanceId, inst);

  for (const inst of sortedInstances) {
    const orientations: { w: number; l: number; rotated: boolean }[] = [
      { w: inst.width, l: inst.length, rotated: false },
    ];
    if (inst.allowRotation && inst.width !== inst.length) {
      orientations.push({ w: inst.length, l: inst.width, rotated: true });
    }

    let bestSheet: SheetContext | null = null;
    let bestLeafIndex = -1;
    let bestSplit: { tree: CutNode; score: number[] } | null = null;
    let bestRotated = false;

    for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
      const ctx = sheets[sIdx];
      const leaves = collectEmptyLeaves(ctx.tree);
      for (let li = 0; li < leaves.length; li++) {
        const leaf = leaves[li];
        for (const orient of orientations) {
          const split = buildPlacementTree(
            leaf.region,
            inst.instanceId,
            orient.w,
            orient.l,
            kerf,
          );
          if (!split) continue;
          const candidateScore = [
            0,
            ...split.score.slice(1),
            sIdx,
          ];
          if (
            !bestSplit ||
            compareScores(candidateScore, bestSplit.score) < 0
          ) {
            bestSplit = { tree: split.tree, score: candidateScore };
            bestSheet = ctx;
            bestLeafIndex = li;
            bestRotated = orient.rotated;
          }
        }
      }
    }

    
    if (!bestSheet || !bestSplit) {
      if (sheets.length < maximumSheetCount) {
        const newCtx = openNewSheet();
        const leaves = collectEmptyLeaves(newCtx.tree);
        for (const orient of orientations) {
          const split = buildPlacementTree(
            leaves[0].region,
            inst.instanceId,
            orient.w,
            orient.l,
            kerf,
          );
          if (!split) continue;
          const candidateScore = [
            1,
            ...split.score.slice(1),
            sheets.length - 1,
          ];
          if (
            !bestSplit ||
            compareScores(candidateScore, bestSplit.score) < 0
          ) {
            bestSplit = { tree: split.tree, score: candidateScore };
            bestSheet = newCtx;
            bestLeafIndex = 0;
            bestRotated = orient.rotated;
          }
        }
      }
    }

    if (!bestSheet || !bestSplit) {
      unplaced.push({
        panelInstanceId: inst.instanceId,
        panelId: inst.panelId,
        name: inst.name,
        width: inst.width,
        length: inst.length,
        displayLabel: inst.displayLabel,
      });
      continue;
    }

    const leaves = collectEmptyLeaves(bestSheet.tree);
    const targetLeaf = leaves[bestLeafIndex];
    bestSheet.tree = replaceAtPath(
      bestSheet.tree,
      targetLeaf.path,
      bestSplit.tree,
    );

    const placedW = bestRotated ? inst.length : inst.width;
    const placedL = bestRotated ? inst.width : inst.length;
    placements.push({
      panelInstanceId: inst.instanceId,
      panelId: inst.panelId,
      sheetId: `sheet-${bestSheet.instanceIndex}`,
      x: targetLeaf.region.x,
      y: targetLeaf.region.y,
      width: placedW,
      length: placedL,
      rotated: bestRotated,
      displayLabel: inst.displayLabel,
    });
  }

  const sheetResults: SheetResult[] = [];
  for (const ctx of sheets) {
    sheetResults.push(
      buildSheetResult(ctx, project, placements, minWidth, minLength),
    );
  }

  const summary = buildSummary(project, sheetResults, instances.length, unplaced);
  return { summary, sheets: sheetResults, unplacedPanels: unplaced };
};

const availableSheetCount = (project: Project): number =>
  project.stockSheets.reduce((sum, s) => sum + s.quantity, 0);

const compareScores = (a: number[], b: number[]): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (Math.abs(av - bv) > EPS) return av - bv;
  }
  return 0;
};

const buildSheetResult = (
  ctx: SheetContext,
  project: Project,
  placements: Placement[],
  minWidth: number,
  minLength: number,
): SheetResult => {
  const cuts = buildCutSequence(ctx.tree, `sheet-${ctx.instanceIndex}`);
  const surplus = classifySurplus(
    ctx.tree,
    `sheet-${ctx.instanceIndex}`,
    ctx.instanceIndex,
    ctx.sheet.material,
    ctx.sheet.thickness,
    minWidth,
    minLength,
  );

  const panelRegions = collectPanelRegions(ctx.tree);
  const kerfStrips = collectKerfStrips(ctx.tree);

  const sheetAreaVal = ctx.sheet.width * ctx.sheet.length;
  const placedArea = panelRegions.reduce(
    (sum, p) => sum + p.region.width * p.region.height,
    0,
  );
  const kerfArea = kerfStrips.reduce(
    (sum, k) => sum + k.region.width * k.region.height,
    0,
  );

  const sheetPlacements = placements.filter(
    (p) => p.sheetId === `sheet-${ctx.instanceIndex}`,
  );

  const statistics: SheetStatistics = {
    sheetArea: sheetAreaVal,
    placedPanelArea: placedArea,
    unusedArea: sheetAreaVal - placedArea,
    utilisationPercent: sheetAreaVal > 0 ? (placedArea / sheetAreaVal) * 100 : 0,
    wastePercent: sheetAreaVal > 0 ? ((sheetAreaVal - placedArea) / sheetAreaVal) * 100 : 0,
    cutCount: cuts.length,
    cutLength: totalCutLength(cuts),
    panelCount: panelRegions.length,
    reusedSurplusArea: surplus.reusableArea,
    scrapArea: surplus.scrapArea,
    kerfLossArea: kerfArea,
  };

  return {
    sheetInstanceId: `sheet-${ctx.instanceIndex}`,
    sheetIndex: ctx.instanceIndex,
    stockSheetId: ctx.sheet.id,
    width: ctx.sheet.width,
    length: ctx.sheet.length,
    material: ctx.sheet.material,
    thickness: ctx.sheet.thickness,
    label: ctx.sheet.label || `Sheet ${ctx.instanceIndex + 1}`,
    tree: ctx.tree,
    placements: sheetPlacements,
    cuts,
    surplus: surplus.surplus,
    statistics,
  };
};

const buildSummary = (
  project: Project,
  sheets: SheetResult[],
  totalInstances: number,
  unplaced: UnplacedPanel[],
): ProjectSummary => {
  const consumedStockArea = sheets.reduce(
    (sum, s) => sum + s.statistics.sheetArea,
    0,
  );
  const placedPanelArea = sheets.reduce(
    (sum, s) => sum + s.statistics.placedPanelArea,
    0,
  );
  const reusableSurplusArea = sheets.reduce(
    (sum, s) => sum + s.statistics.reusedSurplusArea,
    0,
  );
  const scrapArea = sheets.reduce(
    (sum, s) => sum + s.statistics.scrapArea,
    0,
  );
  const kerfLossArea = sheets.reduce(
    (sum, s) => sum + s.statistics.kerfLossArea,
    0,
  );
  const totalCuts = sheets.reduce((sum, s) => sum + s.statistics.cutCount, 0);
  const totalCutLen = sheets.reduce((sum, s) => sum + s.statistics.cutLength, 0);

  const totalUnusedArea = consumedStockArea - placedPanelArea;

  return {
    availableSheetCount: availableSheetCount(project),
    usedSheetCount: sheets.length,
    unusedSheetCount: Math.max(0, availableSheetCount(project) - sheets.length),
    availableStockArea: totalAvailableStockArea(project),
    consumedStockArea,
    placedPanelArea,
    totalUnusedArea,
    reusableSurplusArea,
    scrapArea,
    kerfLossArea,
    utilisationPercent:
      consumedStockArea > 0 ? (placedPanelArea / consumedStockArea) * 100 : 0,
    wastePercent:
      consumedStockArea > 0 ? (totalUnusedArea / consumedStockArea) * 100 : 0,
    totalCuts,
    totalCutLength: totalCutLen,
    theoreticalDifference: theoreticalDifference(project),
    requiredPanelArea: totalRequiredPanelArea(project),
    totalPanelInstances: totalInstances,
  };
};


