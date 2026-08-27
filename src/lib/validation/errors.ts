import type { ZodError } from "zod";

/** One message per field, in the shape the forms render. */
export type FieldErrors = Record<string, string>;

/**
 * Collapses a Zod error into the first message per field. Forms show one
 * message under each input, so later issues on the same field are noise.
 */
export function toFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in out)) out[key] = issue.message;
  }
  return out;
}
