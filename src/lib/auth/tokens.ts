import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Single-use tokens for email verification and password reset.
 *
 * Only a SHA-256 hash of the token is stored. A leaked database therefore
 * yields no usable reset links — the same reasoning as never storing a
 * plaintext password.
 */

const RESET_TTL_MINUTES = 60; // one hour — section 4.4
const VERIFY_TTL_HOURS = 24;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// ------------------------------------------------------------ password reset

export async function createResetToken(email: string): Promise<string> {
  const token = newToken();

  // Any earlier request for this address is invalidated, so a stolen older
  // link stops working the moment a new one is issued.
  await prisma.passwordResetToken.deleteMany({ where: { email, usedAt: null } });

  await prisma.passwordResetToken.create({
    data: {
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    },
  });

  return token;
}

export type ResetLookup =
  | { ok: true; email: string; id: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

export async function consumeResetToken(token: string): Promise<ResetLookup> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!row) return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };

  return { ok: true, email: row.email, id: row.id };
}

// -------------------------------------------------------- email verification

export async function createVerificationToken(email: string): Promise<string> {
  const token = newToken();

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashToken(token),
      expires: new Date(Date.now() + VERIFY_TTL_HOURS * 3_600_000),
    },
  });

  return token;
}

export type VerifyLookup =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

export async function consumeVerificationToken(token: string): Promise<VerifyLookup> {
  const hashed = hashToken(token);
  const row = await prisma.verificationToken.findUnique({ where: { token: hashed } });

  if (!row) return { ok: false, reason: "invalid" };

  await prisma.verificationToken.delete({ where: { token: hashed } });
  if (row.expires < new Date()) return { ok: false, reason: "expired" };

  return { ok: true, email: row.identifier };
}
