export type StockSheet = {
  id: string;
  label: string;
  material?: string;
  thickness?: number;
  width: number;
  length: number;
  quantity: number;
};

export const createStockSheet = (id: string): StockSheet => ({
  id,
  label: "",
  material: "Plywood",
  thickness: 18,
  width: 1219.2,
  length: 2438.4,
  quantity: 1,
});
