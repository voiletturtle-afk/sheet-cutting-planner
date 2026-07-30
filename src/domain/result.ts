export type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CutNode =
  | { type: "panel"; region: Region; panelInstanceId: string }
  | { type: "empty"; region: Region }
  | {
      type: "split";
      region: Region;
      direction: "horizontal" | "vertical";
      cutPosition: number;
      kerf: number;
      first: CutNode;
      second: CutNode;
    };

export type Placement = {
  panelInstanceId: string;
  panelId: string;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  length: number;
  rotated: boolean;
  displayLabel: string;
};

export type CutInstruction = {
  number: number;
  direction: "horizontal" | "vertical";
  sourceRegion: Region;
  cutPosition: number;
  cutLength: number;
  resultLabel: string;
};

export type SurplusPiece = {
  id: string;
  sheetId: string;
  x: number;
  y: number;
  width: number;
  length: number;
  area: number;
  reusable: boolean;
  reason?: string;
  material?: string;
  thickness?: number;
  suggestedLabel: string;
};

export type SheetStatistics = {
  sheetArea: number;
  placedPanelArea: number;
  unusedArea: number;
  utilisationPercent: number;
  wastePercent: number;
  cutCount: number;
  cutLength: number;
  panelCount: number;
  reusedSurplusArea: number;
  scrapArea: number;
  kerfLossArea: number;
};

export type SheetResult = {
  sheetInstanceId: string;
  sheetIndex: number;
  stockSheetId: string;
  width: number;
  length: number;
  material?: string;
  thickness?: number;
  label: string;
  tree: CutNode;
  placements: Placement[];
  cuts: CutInstruction[];
  surplus: SurplusPiece[];
  statistics: SheetStatistics;
};

export type ProjectSummary = {
  availableSheetCount: number;
  usedSheetCount: number;
  unusedSheetCount: number;
  availableStockArea: number;
  consumedStockArea: number;
  placedPanelArea: number;
  totalUnusedArea: number;
  reusableSurplusArea: number;
  scrapArea: number;
  kerfLossArea: number;
  utilisationPercent: number;
  wastePercent: number;
  totalCuts: number;
  totalCutLength: number;
  theoreticalDifference: number;
  requiredPanelArea: number;
  totalPanelInstances: number;
};

export type UnplacedPanel = {
  panelInstanceId: string;
  panelId: string;
  name: string;
  width: number;
  length: number;
  displayLabel: string;
};

export type StockSheetRecommendation = {
  stockSheetId: string;
  label: string;
  currentQuantity: number;
  requiredQuantity: number;
  additionalQuantity: number;
};

export type OptimizationResult = {
  summary: ProjectSummary;
  sheets: SheetResult[];
  unplacedPanels: UnplacedPanel[];
  stockRecommendation?: StockSheetRecommendation;
};


