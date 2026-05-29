import type { ClothingItem, Category } from "@prisma/client";
import { prisma } from "../db";
import { scoreOutfit, pairKey, type ScoringContext, type ScoreBreakdown } from "./scoring";

// Public types ---------------------------------------------------------------

export interface GenerateInput {
  userId: string;
  season: string; // "SUMMER" | "FALL" | "WINTER" | "SPRING"
  occasion: string; // "casual" | "formal" | "athletic" | ...
  weather?: { tempF?: number; rain?: boolean };
  limit?: number; // top N to return (default 5)
  includeOuterwear?: boolean; // override automatic cold-weather detection
  excludeItemIds?: string[]; // useful for "regenerate, but different"
}

export interface GeneratedOutfit {
  outfitId: string; // synthetic id until persisted
  score: number;
  breakdown: ScoreBreakdown;
  items: ClothingItem[];
}

// Tuning knobs ---------------------------------------------------------------

// Per-category top-K. With K=12 the worst case is 12*12*12*12 = 20,736
// combinations (top * bottom * shoes * outerwear), which we'll bound below.
const TOP_K_PER_CATEGORY = 12;

// Hard ceiling on combinations scored, defending against pathological wardrobes.
const MAX_COMBINATIONS = 20_000;

const REQUIRED: Category[] = ["TOP", "BOTTOM", "SHOES"];

// Algorithm ------------------------------------------------------------------

/**
 * Generate outfit recommendations for a user.
 *
 * Pipeline:
 *   1. Filter wardrobe by season (cheap funnel; style is soft-matched, not hard-filtered)
 *   2. Build scoring context once (history + favorites loaded a single time)
 *   3. Pre-rank items within each category and keep the top K
 *   4. Cartesian-product the truncated lists, scoring each combination
 *   5. Diversify the top results so suggestions aren't all the same shirt
 *
 * Why not brute force every combination? A 100-item closet would produce
 * hundreds of thousands of triples. Pre-ranking per category keeps the
 * combinatorial step bounded regardless of wardrobe size while still surfacing
 * the items the user is most likely to want.
 */
export async function generateOutfits(input: GenerateInput): Promise<GeneratedOutfit[]> {
  const { userId, season, occasion, weather, limit = 5, excludeItemIds = [] } = input;

  // ---- 1. Filter -----------------------------------------------------------
  const items = await prisma.clothingItem.findMany({
    where: {
      userId,
      id: excludeItemIds.length ? { notIn: excludeItemIds } : undefined,
      seasons: { hasSome: [season.toUpperCase() as any, "ALL" as any] },
    },
  });

  const byCategory: Record<Category, ClothingItem[]> = {
    TOP: [],
    BOTTOM: [],
    SHOES: [],
    OUTERWEAR: [],
    ACCESSORY: [],
    SLEEPWEAR: [],
  };
  for (const it of items) byCategory[it.category].push(it);

  // Can't form even a base outfit → nothing to suggest.
  if (REQUIRED.some((c) => byCategory[c].length === 0)) return [];

  // Outerwear: include when explicitly requested or when it's cold out.
  // Threshold of 55°F is arbitrary but matches what humans intuitively call
  // "jacket weather" in most climates.
  const includeOuter =
    input.includeOuterwear ??
    (weather?.tempF !== undefined && weather.tempF < 55);

  // ---- 2. Scoring context (loaded once) ------------------------------------
  const ctx = await buildContext(userId, season, occasion);

  // ---- 3. Pre-rank within category -----------------------------------------
  // We rank by a *cheap* per-item proxy first: favorite > style match > season
  // exactness. Final fine-grained scoring still happens at combination time,
  // but this lets us truncate to a manageable number of items per category.
  const topPerCategory = (cat: Category) =>
    [...byCategory[cat]]
      .sort((a, b) => proxyItemScore(b, ctx) - proxyItemScore(a, ctx))
      .slice(0, TOP_K_PER_CATEGORY);

  const tops = topPerCategory("TOP");
  const bottoms = topPerCategory("BOTTOM");
  const shoes = topPerCategory("SHOES");
  const outers: (ClothingItem | null)[] =
    includeOuter && byCategory.OUTERWEAR.length > 0
      ? topPerCategory("OUTERWEAR")
      : [null];

  // ---- 4. Score combinations -----------------------------------------------
  const scored: GeneratedOutfit[] = [];
  let count = 0;
  combos: for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of shoes) {
        for (const outer of outers) {
          if (count++ >= MAX_COMBINATIONS) break combos;
          const outfitItems: ClothingItem[] = outer
            ? [top, bottom, shoe, outer]
            : [top, bottom, shoe];
          const breakdown = scoreOutfit(outfitItems, ctx);
          scored.push({
            outfitId: `gen-${count}`,
            score: breakdown.total,
            breakdown,
            items: outfitItems,
          });
        }
      }
    }
  }

  // ---- 5. Diversify --------------------------------------------------------
  scored.sort((a, b) => b.score - a.score);
  return diversify(scored, limit);
}

// Helpers --------------------------------------------------------------------

/**
 * Cheap per-item score used to pre-rank within a category. We bias toward
 * items the user actually wears: favorites and style/season exactness.
 */
function proxyItemScore(item: ClothingItem, ctx: ScoringContext): number {
  let s = 0;
  if (ctx.favoriteItemIds.has(item.id)) s += 2;
  if (
    item.styles.map((x) => String(x).toUpperCase()).includes(ctx.occasion.toUpperCase())
  )
    s += 1;
  if (item.seasons.includes(ctx.season.toUpperCase() as any)) s += 1; // exact > ALL
  return s;
}

/**
 * Pick top N outfits with a diversity constraint: don't keep recommending the
 * same top. We allow some repetition (up to half the slots) before enforcing
 * uniqueness — the very best top might genuinely belong in two suggestions.
 */
function diversify(sorted: GeneratedOutfit[], limit: number): GeneratedOutfit[] {
  const result: GeneratedOutfit[] = [];
  const seenTopIds = new Map<string, number>();
  const halfwayPoint = Math.ceil(limit / 2);

  for (const outfit of sorted) {
    const topId = outfit.items.find((i) => i.category === "TOP")?.id;
    if (topId) {
      const used = seenTopIds.get(topId) ?? 0;
      if (used >= 1 && result.length >= halfwayPoint) continue;
      seenTopIds.set(topId, used + 1);
    }
    result.push(outfit);
    if (result.length >= limit) break;
  }
  return result;
}

async function buildContext(
  userId: string,
  season: string,
  occasion: string,
): Promise<ScoringContext> {
  const [pairs, favoriteOutfits] = await Promise.all([
    prisma.itemPairing.findMany({ where: { userId } }),
    prisma.outfit.findMany({
      where: { userId, favorite: true },
      include: { items: { select: { itemId: true } } },
    }),
  ]);

  const pairFrequency = new Map<string, number>();
  for (const p of pairs) pairFrequency.set(pairKey(p.itemAId, p.itemBId), p.count);

  // "Favorite items" = items that appear in any outfit the user has favorited.
  // This is a coarser signal than tracking per-item favorites directly, but it
  // requires no extra UI: users just heart outfits they love.
  const favoriteItemIds = new Set<string>();
  for (const o of favoriteOutfits) {
    for (const oi of o.items) favoriteItemIds.add(oi.itemId);
  }

  return { season, occasion, pairFrequency, favoriteItemIds };
}

/**
 * Increment pair counts when an outfit is saved or worn. Called from the
 * outfit and wear endpoints. Uses upsert so the first time a pair appears it
 * starts at 1, then increments thereafter.
 *
 * Why a separate function: the scoring engine reads pairings, and recording
 * them is a side-effect of *every* outfit save/wear — keeping the write in one
 * place means we never forget to update history.
 */
export async function recordPairings(userId: string, itemIds: string[]): Promise<void> {
  const ops = [];
  for (let i = 0; i < itemIds.length; i++) {
    for (let j = i + 1; j < itemIds.length; j++) {
      const [a, b] = itemIds[i] < itemIds[j] ? [itemIds[i], itemIds[j]] : [itemIds[j], itemIds[i]];
      ops.push(
        prisma.itemPairing.upsert({
          where: { userId_itemAId_itemBId: { userId, itemAId: a, itemBId: b } },
          create: { userId, itemAId: a, itemBId: b, count: 1 },
          update: { count: { increment: 1 } },
        }),
      );
    }
  }
  await prisma.$transaction(ops);
}
