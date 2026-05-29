import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

const UpdateBody = z
  .object({
    name: z.string().min(1).max(120),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    colorFamily: z.string().min(1),
    seasons: z.array(z.string()),
    styles: z.array(z.string()),
    tags: z.array(z.string()),
    notes: z.string().nullable(),
  })
  .partial();

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const item = await prisma.clothingItem.findFirst({
    where: { id: params.id, userId: auth.userId },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const parsed = UpdateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Scoped to the user so we never let one user mutate another's items.
  const { count } = await prisma.clothingItem.updateMany({
    where: { id: params.id, userId: auth.userId },
    data: parsed.data as any,
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const item = await prisma.clothingItem.findUnique({ where: { id: params.id } });
  return NextResponse.json(item);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const { count } = await prisma.clothingItem.deleteMany({
    where: { id: params.id, userId: auth.userId },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
