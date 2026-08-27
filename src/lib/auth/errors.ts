/**
 * Reasons a credentials sign-in can be refused.
 *
 * These live in their own module with no imports: the client form needs the
 * string values, and importing them from the auth config would pull Prisma and
 * the Postgres driver into the browser bundle.
 */
export const AUTH_ERRORS = {
  invalid: "InvalidCredentials",
  locked: "AccountLocked",
  blocked: "AccountBlocked",
  unverified: "EmailNotVerified",
} as const;

export type AuthErrorCode = (typeof AUTH_ERRORS)[keyof typeof AUTH_ERRORS];

/** True for a value that is one of our own codes rather than a framework error. */
export function isAuthErrorCode(value: string | undefined): value is AuthErrorCode {
  return Object.values(AUTH_ERRORS).includes(value as AuthErrorCode);
}
