import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/**
 * The session and token carry the user id and role, which the default types
 * do not include. Without this augmentation every consumer needs a cast.
 *
 * The JWT interface is augmented on @auth/core/jwt rather than next-auth/jwt:
 * the latter only re-exports it, and augmenting a re-export does not reach
 * the original declaration.
 */
declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
