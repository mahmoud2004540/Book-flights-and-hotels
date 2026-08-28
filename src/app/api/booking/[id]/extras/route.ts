import { NextResponse } from "next/server";
import { extrasSchema } from "@/lib/validation/booking";
import { draftTotal, readDraft, saveDraft } from "@/server/booking/draft";

/** Step 4 — baggage, seats and insurance. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const draft = await readDraft(id);

  if (!draft) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 });
  }

  const parsed = extrasSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 422 });
  }

  draft.extras = parsed.data;
  await saveDraft(draft);

  return NextResponse.json({
    ok: true,
    total: { amount: draftTotal(draft).toFixed(2), currency: draft.quotedPrice.currency },
  });
}
