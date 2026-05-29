import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

const UpdateBody = z
  .object({
    name: z.string().min(1).max(120),
    tags: z.array(z.string()),
    occasion: z.string().nullable(),
    season: z.enum(["SUMMER", "FALL", "WINTER", "SPRING", "ALL"]).nullable(),
    favorite: z.boolean(),
    itemIds: z.array(z.string()).min(2),
  })
  .partial();

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const outfit = await prisma.outfit.findFirst({
    where: { id: params.id, userId: auth.userId },
    include: { items: { include: { item: true } } },
  });
  if (!outfit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(outfit);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const parsed = UpdateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { itemIds, ...rest } = parsed.data;

  // Replacing item list is its own concern — wrap in a transaction so we don't
  // end up with a half-updated outfit.
  const outfit = await prisma.$transaction(async (tx) => {
    const existing = await tx.outfit.findFirst({
      where: { id: params.id, userId: auth.userId },
      select: { id: true },
    });
    if (!existing) return null;

    if (itemIds) {
      const owned = await tx.clothingItem.count({
        where: { userId: auth.userId, id: { in: itemIds } },
      });
      if (owned !== itemIds.length) throw new Error("Items not owned by user");
      await tx.outfitItem.deleteMany({ where: { outfitId: params.id } });
      await tx.outfitItem.createMany({
        data: itemIds.map((itemId) => ({ outfitId: params.id, itemId })),
      });
    }

    await tx.outfit.update({ where: { id: params.id }, data: rest as any });
    return tx.outfit.findUnique({
      where: { id: params.id },
      include: { items: { include: { item: true } } },
    });
  });

  if (!outfit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(outfit);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { count } = await prisma.outfit.deleteMany({
    where: { id: params.id, userId: auth.userId },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
