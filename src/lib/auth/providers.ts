import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";

/**
 * Social providers are registered only when their credentials exist, so the
 * app runs locally without them and the sign-in page shows exactly the
 * buttons that will actually work.
 */
export function socialProviders(): Provider[] {
  const providers: Provider[] = [];

  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (googleId && googleSecret) {
    providers.push(Google({ clientId: googleId, clientSecret: googleSecret }));
  }

  const appleId = process.env.APPLE_CLIENT_ID;
  const appleSecret = process.env.APPLE_CLIENT_SECRET;
  if (appleId && appleSecret) {
    providers.push(Apple({ clientId: appleId, clientSecret: appleSecret }));
  }

  return providers;
}

/** Which social buttons the sign-in page should render. */
export function enabledSocialProviders(): ReadonlyArray<"google" | "apple"> {
  const enabled: Array<"google" | "apple"> = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) enabled.push("google");
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) enabled.push("apple");
  return enabled;
}
