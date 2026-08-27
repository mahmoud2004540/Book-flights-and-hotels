import { CredentialsSignin } from "next-auth";
import type { AuthErrorCode } from "./errors";

/**
 * NextAuth deliberately masks anything thrown from authorize() as a generic
 * "CredentialsSignin", so a plain Error never reaches the browser. The one
 * value that does travel is CredentialsSignin.code, which is surfaced as the
 * `code` field of the signIn() result.
 *
 * None of the codes we set distinguish a wrong password from an unknown email
 * — see authorize() — so nothing here helps an attacker enumerate accounts.
 */
export class AuthError extends CredentialsSignin {
  override code: string;

  constructor(code: AuthErrorCode) {
    super(code);
    this.code = code;
  }
}
