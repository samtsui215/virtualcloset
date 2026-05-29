import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

const CATEGORY = ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORY"] as const;
const SEASON = ["SUMMER", "FALL", "WINTER", "SPRING", "ALL"] as const;
const STYLE = ["CASUAL", "FORMAL", "ATHLETIC", "BUSINESS", "STREETWEAR"] as const;

const CreateBody = z.object({
  name: z.string().min(1).max(120),
  category: z.enum(CATEGORY),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  colorFamily: z.string().min(1),
  seasons: z.array(z.enum(SEASON)).min(1),
  styles: z.array(z.enum(STYLE)).min(1),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  imageUrl: z.string().url().or(z.string().startsWith("/uploads/")),
  imageBlurDataUrl: z.string().optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
});

// GET /api/items
//   Filtering, full-text search, pagination.
//   Query params: category, season, style, tag (repeatable), q (search), limit, cursor
export async function GET(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const season = url.searchParams.get("season");
  const style = url.searchParams.get("style");
  const tags = url.searchParams.getAll("tag");
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 60), 200);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const items = await prisma.clothingItem.findMany({
    where: {
      userId: auth.userId,
      category: category ? (category as any) : undefined,
      seasons: season ? { has: season as any } : undefined,
      styles: style ? { has: style as any } : undefined,
      tags: tags.length ? { hasEvery: tags } : undefined,
      // Postgres-side ILIKE across name and notes covers the most common
      // "where's my white linen shirt?" search. For larger wardrobes we'd swap
      // this for a tsvector column + GIN index.
      OR: q
        ? [
            { name: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
            { tags: { has: q } },
          ]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  });

  const nextCursor = items.length > limit ? items[limit].id : null;
  return NextResponse.json({ items: items.slice(0, limit), nextCursor });
}

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.format() }, { status: 400 });
  }

  const item = await prisma.clothingItem.create({
    data: { ...parsed.data, userId: auth.userId },
  });
  return NextResponse.json(item, { status: 201 });
}
