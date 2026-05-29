import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { recordPairings } from "@/lib/outfit/generator";

// Feedback on a *generated* (or saved) outfit.
// If a like is given for a transient, never-saved generated outfit, the client
// can include the item ids so we still capture the signal in ItemPairing.
const Body = z.object({
  outfitId: z.string().optional(),
  signal: z.union([z.literal(1), z.literal(-1)]),
  itemIds: z.array(z.string()).optional(), // present only when outfitId is synthetic
});

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { outfitId, signal, itemIds } = parsed.data;

  if (outfitId) {
    // Persisted outfit path — record an OutfitFeedback row.
    const outfit = await prisma.outfit.findFirst({ where: { id: outfitId, userId: auth.userId } });
    if (!outfit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.outfitFeedback.create({
      data: { outfitId, userId: auth.userId, signal },
    });
  }

  // Whether or not the outfit is persisted, a "like" still teaches the model:
  // bump the pair frequencies for the items involved. A "dislike" is recorded
  // as feedback above but we deliberately don't *decrement* pair counts —
  // doing so would let a few dislikes erase real history.
  if (signal === 1 && itemIds?.length) {
    await recordPairings(auth.userId, itemIds);
  }

  return NextResponse.json({ ok: true });
}
