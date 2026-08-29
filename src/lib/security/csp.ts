/**
 * The Content-Security-Policy — section 8.
 *
 * Every origin below is one the app actually contacts. Anything not listed is
 * blocked, so a supplier that starts serving images from a new host fails
 * visibly here rather than quietly widening what the page may load.
 *
 * On `'unsafe-inline'` in script-src, deliberately and with its cost stated:
 * Next injects inline bootstrap scripts whose contents differ per page, so they
 * can be allowed only by a per-request nonce. Next takes that nonce from the
 * request's own CSP header, and a proxy cannot put it there — NextRequest
 * headers are immutable, so the value arrives at the renderer as undefined and
 * every script on the page is refused. A policy that breaks the application is
 * not a policy.
 *
 * What this costs: CSP will not stop an injected inline script. What still
 * holds, and is most of the value here: no third-party script origin may load
 * at all, an injected script has nowhere to send what it steals because
 * connect-src is closed, the site cannot be framed, no form may post
 * elsewhere, and no <base> tag may redirect relative URLs. The reason a
 * script-injection would need CSP in the first place is also absent — the app
 * renders no user-supplied HTML anywhere, and its one inline script is a
 * constant.
 */

/** Card fields are Stripe's iframe, which is what keeps us inside PCI-DSS SAQ-A. */
const STRIPE_SCRIPT = "https://js.stripe.com";
const STRIPE_FRAME = "https://js.stripe.com https://hooks.stripe.com";
const STRIPE_API = "https://api.stripe.com";
const STRIPE_IMG = "https://*.stripe.com";

/** Map tiles. Mapbox only when a token is configured; OpenStreetMap otherwise. */
const MAP =
  "https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://api.mapbox.com";

export function contentSecurityPolicy(isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      STRIPE_SCRIPT,
      // Dev builds evaluate the React refresh runtime.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // React sets style attributes directly and MapLibre writes its own, so
    // inline CSS cannot be removed. No third-party stylesheet is allowed.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Fonts are self-hosted by next/font, so no external font origin is needed.
    "font-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:", MAP, STRIPE_IMG],
    "connect-src": ["'self'", STRIPE_API, MAP, ...(isDev ? ["ws:"] : [])],
    // MapLibre renders tiles in a worker it creates from a blob.
    "worker-src": ["'self'", "blob:"],
    "frame-src": [STRIPE_FRAME],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };

  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}
