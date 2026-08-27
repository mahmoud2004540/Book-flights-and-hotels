import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/errors";
import { hashPassword } from "@/lib/auth/password";
import { consumeResetToken } from "@/lib/auth/tokens";
import { clearFailures } from "@/lib/auth/rate-limit";
import { sendMail } from "@/lib/mail";

/** Completes a password reset against a single-use token. */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = resetPasswordSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, fieldErrors: toFieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { token, password } = parsed.data;
  const lookup = await consumeResetToken(token);
  if (!lookup.ok) {
    return NextResponse.json({ ok: false, reason: lookup.reason }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);

  // The update and the token burn go together: if the write succeeds but the
  // token stays open, the link could be replayed to set another password.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { email: lookup.email },
      // Choosing a new password from a link sent to that inbox proves control
      // of the address, so an unverified account becomes verified here.
      data: { passwordHash, emailVerifiedAt: new Date() },
    });
    await tx.passwordResetToken.update({
      where: { id: lookup.id },
      data: { usedAt: new Date() },
    });
  });

  // A successful reset clears the lock, so someone who forgot their password
  // and triggered the lockout is not still locked out afterwards.
  await clearFailures(lookup.email);

  const sent = await sendMail(lookup.email, { kind: "passwordChanged" });
  if (!sent.ok) console.error(`Password-changed notice failed: ${sent.error}`);

  return NextResponse.json({ ok: true });
}
