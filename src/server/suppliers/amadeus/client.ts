import { SUPPLIER_TIMEOUTS } from "@/lib/config";
import { SupplierError, classifyStatus } from "../errors";
import { withTimeout } from "../resilience/timeout";
import { logSupplierCall } from "../logging";

const SUPPLIER_ID = "amadeus";

/**
 * Amadeus OAuth2 client credentials — section 3.2.
 *
 * The token is cached in module scope and refreshed early, before it actually
 * expires: requesting a new one only after a 401 would fail a real search
 * first, and the traveller would see that failure.
 */
type CachedToken = { value: string; expiresAt: number };

let cachedToken: CachedToken | null = null;

/** Refresh this long before expiry, to absorb clock skew and slow requests. */
const REFRESH_MARGIN_MS = 60_000;

export type AmadeusCredentials = {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
};

export function readCredentials(): AmadeusCredentials | null {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    baseUrl: process.env.AMADEUS_BASE_URL ?? "https://test.api.amadeus.com",
  };
}

async function fetchToken(credentials: AmadeusCredentials): Promise<CachedToken> {
  const started = Date.now();
  const endpoint = "/v1/security/oauth2/token";

  const response = await withTimeout(SUPPLIER_ID, SUPPLIER_TIMEOUTS.perRequestMs, (signal) =>
    fetch(`${credentials.baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
      signal,
      cache: "no-store",
    }),
  );

  const durationMs = Date.now() - started;

  if (!response.ok) {
    const body = await response.text();
    logSupplierCall({
      supplierId: SUPPLIER_ID,
      endpoint,
      durationMs,
      statusCode: response.status,
      error: body,
    });
    throw new SupplierError(
      SUPPLIER_ID,
      classifyStatus(response.status),
      `Token request failed: ${body}`,
      response.status,
    );
  }

  logSupplierCall({ supplierId: SUPPLIER_ID, endpoint, durationMs, statusCode: 200 });

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token || !payload.expires_in) {
    throw new SupplierError(SUPPLIER_ID, "malformedResponse", "Token response missing fields");
  }

  return {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
}

async function getToken(credentials: AmadeusCredentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return cachedToken.value;
  }
  cachedToken = await fetchToken(credentials);
  return cachedToken.value;
}

/** Test hook — drops the cached token so a case starts from a known state. */
export function clearTokenCache(): void {
  cachedToken = null;
}

export async function amadeusGet<T>(
  credentials: AmadeusCredentials,
  endpoint: string,
  query: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const token = await getToken(credentials);

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }

  const started = Date.now();
  const response = await withTimeout(SUPPLIER_ID, SUPPLIER_TIMEOUTS.perRequestMs, (signal) =>
    fetch(`${credentials.baseUrl}${endpoint}?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.amadeus+json" },
      signal,
      cache: "no-store",
    }),
  );

  const durationMs = Date.now() - started;

  if (!response.ok) {
    const body = await response.text();
    logSupplierCall({
      supplierId: SUPPLIER_ID,
      endpoint,
      durationMs,
      statusCode: response.status,
      error: body,
    });

    // A rejected token means the cached one is stale; drop it so the next
    // call fetches a fresh one rather than repeating the same failure.
    if (response.status === 401) cachedToken = null;

    throw new SupplierError(
      SUPPLIER_ID,
      classifyStatus(response.status),
      `${endpoint} failed: ${body.slice(0, 300)}`,
      response.status,
    );
  }

  logSupplierCall({ supplierId: SUPPLIER_ID, endpoint, durationMs, statusCode: 200 });
  return (await response.json()) as T;
}
