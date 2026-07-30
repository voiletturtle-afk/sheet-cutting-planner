import type { MeasurementUnit } from "@/domain/project";

export type UnitConversion = {
  toMm: number;
};

export const UNIT_CONVERSIONS: Record<MeasurementUnit, UnitConversion> = {
  mm: { toMm: 1 },
  cm: { toMm: 10 },
  m: { toMm: 1000 },
  in: { toMm: 25.4 },
};

export const convertToMm = (value: number, unit: MeasurementUnit): number =>
  value * UNIT_CONVERSIONS[unit].toMm;

export const formatMm = (mm: number, unit: MeasurementUnit): string => {
  const divisor = UNIT_CONVERSIONS[unit].toMm;
  const converted = mm / divisor;
  const rounded =
    converted >= 100 ? Math.round(converted) : Math.round(converted * 10) / 10;
  return `${rounded} ${unit}`;
};

export const formatMmPlain = (mm: number): string => {
  const rounded = Math.round(mm * 10) / 10;
  return `${rounded} mm`;
};

export const formatArea = (areaMm2: number): string => {
  if (areaMm2 >= 1_000_000) {
    return `${(areaMm2 / 1_000_000).toFixed(2)} m²`;
  }
  return `${Math.round(areaMm2).toLocaleString()} mm²`;
};
