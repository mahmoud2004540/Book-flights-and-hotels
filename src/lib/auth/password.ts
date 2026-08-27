import { compare, hash } from "bcryptjs";

/**
 * bcrypt with a cost of 12. Cost is a deliberate trade: high enough that
 * offline cracking of a leaked hash is expensive, low enough that a sign-in
 * stays well under a second on serverless hardware.
 */
const COST = 12;

export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, COST);
}

export function verifyPassword(plaintext: string, hashed: string): Promise<boolean> {
  return compare(plaintext, hashed);
}

/**
 * A dummy hash with the same cost, compared against when no user exists.
 * Without it, a missing account returns noticeably faster than a wrong
 * password, and that timing difference alone reveals which emails are registered.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.aBrGCJp5tjKUvOsNWEHTa/AL1Zk3RmO";

export async function burnTimeOnMissingUser(plaintext: string): Promise<void> {
  await compare(plaintext, DUMMY_HASH);
}
