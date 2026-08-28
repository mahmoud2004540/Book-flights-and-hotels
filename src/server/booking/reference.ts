import { randomBytes } from "node:crypto";

/**
 * The booking reference the traveller quotes to support.
 *
 * Alphabet excludes I, O, 0 and 1: this gets read down a phone line and
 * written on paper, where those four are routinely confused for each other.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function bookingReference(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return `RHL-${out}`;
}
