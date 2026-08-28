import { NextResponse } from "next/server";
import { passengersSchema, validatePassengers } from "@/lib/validation/booking";
import { toFieldErrors } from "@/lib/validation/errors";
import { readDraft, saveDraft } from "@/server/booking/draft";

/** Step 3 — traveller details, with the age and passport rules applied. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const draft = await readDraft(id);

  if (!draft) {
    return NextResponse.json({ ok: false, reason: "expired" }, { status: 410 });
  }

  const parsed = passengersSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, fieldErrors: toFieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const issues = validatePassengers(parsed.data.passengers, parsed.data.departDate);
  if (issues.length > 0) {
    return NextResponse.json({ ok: false, issues }, { status: 422 });
  }

  draft.passengers = parsed.data.passengers;
  await saveDraft(draft);
  return NextResponse.json({ ok: true });
}
