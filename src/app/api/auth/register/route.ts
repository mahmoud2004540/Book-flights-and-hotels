import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signUpSchema } from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/errors";
import { hashPassword } from "@/lib/auth/password";
import { createVerificationToken } from "@/lib/auth/tokens";
import { appUrl } from "@/lib/auth/urls";
import { sendMail } from "@/lib/mail";

/**
 * Sign-up.
 *
 * The response is identical whether or not the address is already registered.
 * Saying "this email is taken" turns the form into a way to test which
 * addresses have accounts here — for a travel site, that leaks who your
 * customers are.
 */
const NEUTRAL_RESPONSE = {
  ok: true,
  message: "Check your inbox for a confirmation link.",
} as const;

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Malformed request body." },
      { status: 400 },
    );
  }

  const parsed = signUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, fieldErrors: toFieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { name, email, password } = parsed.data;

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });

    const token = await createVerificationToken(email);
    const sent = await sendMail(email, {
      kind: "verifyEmail",
      name: user.name,
      url: appUrl(`/verify-email?token=${token}`),
    });

    if (!sent.ok) {
      // The account exists but is unreachable. Log it for support rather than
      // leaving a user who can never confirm and never knows why.
      console.error(`Verification email failed for ${email}: ${sent.error}`);
    }
  } catch (error) {
    const isDuplicate =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

    if (!isDuplicate) {
      console.error("Registration failed:", error);
      return NextResponse.json(
        { ok: false, message: "Could not create the account. Try again." },
        { status: 500 },
      );
    }
    // Duplicate email falls through to the same neutral response below.
  }

  return NextResponse.json(NEUTRAL_RESPONSE, { status: 200 });
}
