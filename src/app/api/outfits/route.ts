import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { recordPairings } from "@/lib/outfit/generator";

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  itemIds: z.array(z.string()).min(2), // require at least 2 items to be a real "outfit"
  tags: z.array(z.string()).default([]),
  occasion: z.string().optional(),
  season: z.enum(["SUMMER", "FALL", "WINTER", "SPRING", "ALL"]).optional(),
  favorite: z.boolean().optional(),
  generated: z.boolean().optional(),
});

// GET /api/outfits — list with optional filters
export async function GET(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const season = url.searchParams.get("season");
  const occasion = url.searchParams.get("occasion");
  const tag = url.searchParams.get("tag");
  const favorite = url.searchParams.get("favorite");
  const q = url.searchParams.get("q")?.trim();

  const outfits = await prisma.outfit.findMany({
    where: {
      userId: auth.userId,
      season: season ? (season as any) : undefined,
      occasion: occasion ?? undefined,
      tags: tag ? { has: tag } : undefined,
      favorite: favorite === "true" ? true : undefined,
      OR: q
        ? [{ name: { contains: q, mode: "insensitive" } }, { tags: { has: q } }]
        : undefined,
    },
    include: { items: { include: { item: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ outfits });
}

// POST /api/outfits — create a new outfit
export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.format() }, { status: 400 });
  }
  const { itemIds, ...rest } = parsed.data;

  // Verify every item belongs to this user. Guards against a malicious client
  // attaching another user's items to their outfit.
  const owned = await prisma.clothingItem.count({
    where: { userId: auth.userId, id: { in: itemIds } },
  });
  if (owned !== itemIds.length) {
    return NextResponse.json({ error: "Items not owned by user" }, { status: 403 });
  }

  const outfit = await prisma.outfit.create({
    data: {
      ...rest,
      userId: auth.userId,
      items: { create: itemIds.map((itemId) => ({ itemId })) },
    },
    include: { items: { include: { item: true } } },
  });

  // Side-effect: record pair co-occurrences so the generator learns from this.
  // We do it here (not in a trigger) because the same logic is also called on
  // OutfitWear creation.
  await recordPairings(auth.userId, itemIds);

  return NextResponse.json(outfit, { status: 201 });
}
