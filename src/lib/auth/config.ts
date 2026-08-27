import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { signInSchema } from "@/lib/validation/auth";
import { burnTimeOnMissingUser, verifyPassword } from "./password";
import { checkLock, clearFailures, recordFailure } from "./rate-limit";
import { socialProviders } from "./providers";
import { AUTH_ERRORS } from "./errors";
import { AuthError } from "./credentials-error";

/**
 * Session strategy is JWT because the Credentials provider cannot use database
 * sessions. The brief asks for a 15-minute access token with a 30-day refresh
 * window; NextAuth expresses the same shape as a 30-day session whose token is
 * rotated every 15 minutes, which is what maxAge and updateAge do here.
 */
const FIFTEEN_MINUTES = 15 * 60;
const THIRTY_DAYS = 30 * 24 * 60 * 60;

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: THIRTY_DAYS, updateAge: FIFTEEN_MINUTES },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  trustHost: true,

  providers: [
    ...socialProviders(),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const lock = await checkLock(email);
        if (lock.locked) throw new AuthError(AUTH_ERRORS.locked);

        const user = await prisma.user.findUnique({ where: { email } });

        // No account: still spend the time a real comparison would take, and
        // report the same outcome a wrong password would. Both the timing and
        // the message have to match, or either one reveals which addresses are
        // registered here.
        if (!user?.passwordHash) {
          await burnTimeOnMissingUser(password);
          const now = await recordFailure(email);
          throw new AuthError(now.locked ? AUTH_ERRORS.locked : AUTH_ERRORS.invalid);
        }

        if (user.isBlocked) throw new AuthError(AUTH_ERRORS.blocked);

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          const now = await recordFailure(email);
          throw new AuthError(now.locked ? AUTH_ERRORS.locked : AUTH_ERRORS.invalid);
        }

        if (!user.emailVerifiedAt) throw new AuthError(AUTH_ERRORS.unverified);

        await clearFailures(email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        return token;
      }

      // On refresh, re-read role and blocked state from the database so a
      // revoked admin or a blocked account loses access without waiting for
      // the 30-day session to expire.
      if (token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, isBlocked: true },
        });
        if (!fresh || fresh.isBlocked) return null;
        token.role = fresh.role;
      }
      return token;
    },

    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
