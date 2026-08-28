import { NextResponse } from "next/server";
import { readDraft, saveDraft } from "@/server/booking/draft";

/**
 * The explicit consent a changed price requires — section 4.5.
 * Without this call the confirm step refuses to proceed.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const draft = await readDraft(id);

  if (!draft) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 });
  }
  if (!draft.confirmedPrice) {
    return NextResponse.json({ ok: false, reason: "not_priced" }, { status: 409 });
  }

  draft.priceAccepted = true;
  await saveDraft(draft);
  return NextResponse.json({ ok: true });
}
