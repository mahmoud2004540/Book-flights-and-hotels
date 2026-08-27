import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeVerificationToken } from "@/lib/auth/tokens";

/** Confirms an email address from the link in the verification email. */
export async function POST(request: Request): Promise<NextResponse> {
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };

  if (!token) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const result = await consumeVerificationToken(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
  }

  // Idempotent on purpose: clicking the link twice, or a mail client
  // prefetching it, should not produce an error the user has to think about.
  await prisma.user.updateMany({
    where: { email: result.email, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
