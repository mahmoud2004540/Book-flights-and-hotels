import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { createResetToken } from "@/lib/auth/tokens";
import { appUrl } from "@/lib/auth/urls";
import { sendMail } from "@/lib/mail";
import { checkAuthLimit, clientIp } from "@/server/rate-limit";
import { recordResetMail, resetMailAllowed } from "@/server/mail-limit";

/**
 * Starts a password reset.
 *
 * Always answers the same way, whether or not the address has an account —
 * otherwise this endpoint becomes a way to enumerate registered users.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const perIp = checkAuthLimit(clientIp(request));
  if (!perIp.allowed) {
    return NextResponse.json(
      { ok: false, message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "retry-after": String(perIp.retryAfterSeconds) } },
    );
  }

  const parsed = forgotPasswordSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid email address." },
      { status: 422 },
    );
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Accounts without a password signed up through Google or Apple; a reset
  // link would create a second way in that they never asked for.
  // Silently past the per-address cap: the answer below must stay identical
  // whatever happens here, or the difference becomes the enumeration oracle
  // this endpoint was written to avoid.
  if (user?.passwordHash && (await resetMailAllowed(email))) {
    const token = await createResetToken(email);
    const sent = await sendMail(email, {
      kind: "resetPassword",
      url: appUrl(`/reset-password?token=${token}`),
    });
    if (sent.ok) await recordResetMail(email);
    else console.error(`Reset email failed for ${email}: ${sent.error}`);
  }

  return NextResponse.json({
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  });
}
