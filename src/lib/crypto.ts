import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for passport numbers at rest — section 8.
 *
 * GCM rather than CBC because it authenticates as well as encrypts: a tampered
 * ciphertext fails to decrypt instead of silently returning garbage.
 *
 * Stored format: iv:authTag:ciphertext, all base64. The IV is random per value,
 * so encrypting the same passport twice produces different ciphertext and an
 * attacker with database access cannot tell which travellers share a document.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // the size GCM is specified for
const KEY_BYTES = 32;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32",
    );
  }

  const key = Buffer.from(raw, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_BYTES} bytes as hex (${KEY_BYTES * 2} characters), got ${key.length}.`,
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext: expected iv:authTag:ciphertext.");
  }

  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Show only the last four characters — for display without decrypting to the client. */
export function maskDocument(value: string): string {
  if (value.length <= 4) return "•".repeat(value.length);
  return `${"•".repeat(value.length - 4)}${value.slice(-4)}`;
}
