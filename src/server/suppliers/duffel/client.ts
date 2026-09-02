import { SUPPLIER_TIMEOUTS } from "@/lib/config";
import { SupplierError, classifyStatus } from "../errors";
import { withTimeout } from "../resilience/timeout";
import { logSupplierCall } from "../logging";

const SUPPLIER_ID = "duffel";

/**
 * Duffel's HTTP client.
 *
 * Simpler than the Amadeus one because Duffel authenticates with a long-lived
 * access token rather than OAuth — there is no token to fetch, cache or
 * refresh, and so no window where a stale token fails a real search.
 *
 * The version header is not optional. Duffel routes every request by it, and
 * omitting it gets a 400 rather than a default, which is the behaviour you
 * want from an API that changes response shapes between versions.
 */
const DUFFEL_VERSION = "v2";

export type DuffelCredentials = {
  accessToken: string;
  baseUrl: string;
};

export function readCredentials(): DuffelCredentials | null {
  const accessToken = process.env.DUFFEL_ACCESS_TOKEN;
  if (!accessToken) return null;

  return {
    accessToken,
    baseUrl: process.env.DUFFEL_BASE_URL ?? "https://api.duffel.com",
  };
}

/**
 * A test token issued by Duffel starts with duffel_test. Worth knowing at the
 * call site: test tokens return fabricated airlines and fares, which must never
 * be presented as real availability.
 */
export function isTestToken(credentials: DuffelCredentials): boolean {
  return credentials.accessToken.startsWith("duffel_test");
}

type RequestOptions = {
  method: "GET" | "POST";
  endpoint: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
};

async function request<T>(credentials: DuffelCredentials, options: RequestOptions): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const suffix = params.size > 0 ? `?${params}` : "";

  const started = Date.now();
  const response = await withTimeout(SUPPLIER_ID, SUPPLIER_TIMEOUTS.perRequestMs, (signal) =>
    fetch(`${credentials.baseUrl}${options.endpoint}${suffix}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Duffel-Version": DUFFEL_VERSION,
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
      cache: "no-store",
    }),
  );

  const durationMs = Date.now() - started;

  if (!response.ok) {
    const text = await response.text();
    logSupplierCall({
      supplierId: SUPPLIER_ID,
      endpoint: options.endpoint,
      durationMs,
      statusCode: response.status,
      error: text,
    });

    throw new SupplierError(
      SUPPLIER_ID,
      classifyStatus(response.status),
      `${options.endpoint} failed: ${text.slice(0, 300)}`,
      response.status,
    );
  }

  logSupplierCall({
    supplierId: SUPPLIER_ID,
    endpoint: options.endpoint,
    durationMs,
    statusCode: 200,
  });
  return (await response.json()) as T;
}

export function duffelGet<T>(
  credentials: DuffelCredentials,
  endpoint: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  return request<T>(credentials, { method: "GET", endpoint, query });
}

export function duffelPost<T>(
  credentials: DuffelCredentials,
  endpoint: string,
  body: unknown,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  return request<T>(credentials, { method: "POST", endpoint, body, query });
}
