import type { ClothingItem } from "@prisma/client";
import { colorCompatibility, type ColorFamily } from "./color";

// Weights map 1:1 to the spec. Centralized so they can be tuned, A/B tested,
// or replaced with user-personalized weights once we collect enough feedback.
export const WEIGHTS = {
  color: 3,
  season: 2,
  style: 3,
  history: 4,
  favorite: 5,
  exploration: 1,
} as const;

export interface ScoringContext {
  season: string;
  occasion: string;
  pairFrequency: Map<string, number>; // canonical "itemA|itemB" -> co-occurrence count
  favoriteItemIds: Set<string>;
}

export interface ScoreBreakdown {
  total: number;
  // Each sub-score is normalized 0..1 *before* the weight is applied.
  // We surface the breakdown so the UI can later show "why this outfit".
  color: number;
  season: number;
  style: number;
  history: number;
  favorite: number;
  exploration: number;
}

export function scoreOutfit(items: ClothingItem[], ctx: ScoringContext): ScoreBreakdown {
  const color = colorScore(items);
  const season = seasonScore(items, ctx.season);
  const style = styleScore(items, ctx.occasion);
  const history = historyScore(items, ctx.pairFrequency);
  const favorite = favoriteScore(items, ctx.favoriteItemIds);

  // Exploration bonus only applies when there's no prior history for any pair.
  // This nudges the generator toward novel combinations the user hasn't seen,
  // without overwhelming the signal from outfits they've actually liked.
  const exploration = history === 0 ? 1 : 0;

  const total =
    color * WEIGHTS.color +
    season * WEIGHTS.season +
    style * WEIGHTS.style +
    history * WEIGHTS.history +
    favorite * WEIGHTS.favorite +
    exploration * WEIGHTS.exploration;

  return { total, color, season, style, history, favorite, exploration };
}

function colorScore(items: ClothingItem[]): number {
  // Average pairwise compatibility across every (i, j) pair in the outfit.
  // Pairwise is the right unit of analysis here — an outfit with two great pairs
  // and one clash should score worse than three good pairs.
  let sum = 0;
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      sum += colorCompatibility(
        items[i].colorFamily as ColorFamily,
        items[j].colorFamily as ColorFamily,
      );
      n++;
    }
  }
  return n ? sum / n : 0;
}

function seasonScore(items: ClothingItem[], season: string): number {
  if (!season) return 0;
  const target = season.toUpperCase();
  const matches = items.filter(
    (it) => it.seasons.includes(target as any) || it.seasons.includes("ALL" as any),
  ).length;
  return matches / items.length;
}

function styleScore(items: ClothingItem[], occasion: string): number {
  if (!occasion) return 0;
  const target = occasion.toUpperCase();
  const matches = items.filter((it) =>
    it.styles.map((s) => String(s).toUpperCase()).includes(target),
  ).length;
  return matches / items.length;
}

function historyScore(items: ClothingItem[], pairFrequency: Map<string, number>): number {
  let total = 0;
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      total += pairFrequency.get(pairKey(items[i].id, items[j].id)) ?? 0;
      n++;
    }
  }
  if (!n) return 0;
  // log(1 + x) softens the contribution of a single very-frequent pair so it
  // doesn't dominate other signals.
  return Math.log(1 + total / n);
}

function favoriteScore(items: ClothingItem[], favIds: Set<string>): number {
  const matches = items.filter((it) => favIds.has(it.id)).length;
  return matches / items.length;
}

// Canonical key for an item pair, independent of order.
// Used both here and when incrementing ItemPairing rows.
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
