import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { generateOutfits } from "@/lib/outfit/generator";

// POST /api/outfits/generate
// Body:
//   {
//     "season": "summer",
//     "occasion": "casual",
//     "weather": { "tempF": 72, "rain": false },   (optional)
//     "limit": 5,                                  (optional, default 5)
//     "excludeItemIds": [],                        (optional, for "regenerate")
//     "includeOuterwear": false                    (optional override)
//   }
const Body = z.object({
  season: z.enum(["summer", "fall", "winter", "spring", "SUMMER", "FALL", "WINTER", "SPRING"]),
  occasion: z.string().min(1).max(40),
  weather: z
    .object({ tempF: z.number().optional(), rain: z.boolean().optional() })
    .optional(),
  limit: z.number().int().min(1).max(20).optional(),
  excludeItemIds: z.array(z.string()).optional(),
  includeOuterwear: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.format() }, { status: 400 });
  }

  const outfits = await generateOutfits({
    userId: auth.userId,
    season: parsed.data.season.toUpperCase(),
    occasion: parsed.data.occasion,
    weather: parsed.data.weather,
    limit: parsed.data.limit,
    excludeItemIds: parsed.data.excludeItemIds,
    includeOuterwear: parsed.data.includeOuterwear,
  });

  // Match the spec's response shape — array of { outfitId, score, items }.
  return NextResponse.json(
    outfits.map((o) => ({
      outfitId: o.outfitId,
      score: Number(o.score.toFixed(3)),
      breakdown: o.breakdown,
      items: o.items,
    })),
  );
}
