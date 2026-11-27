/**
 * Typed HTTP client for the Buyer Frontend API (`/api/v1`).
 *
 * - Base URL comes from VITE_API_BASE_URL (full root incl. `/api/v1`, or just the origin).
 * - Auth header is `Authorization: Token <token>`; the token lives in localStorage.
 * - Errors follow the contract envelope: `{ error: { code, message: string | { field: message } } }`.
 */

const TOKEN_KEY = "studio_token";

function resolveBase(raw: string | undefined): string {
  const v = (raw || "http://127.0.0.1:8000").trim().replace(/\/+$/, "");
  return /\/api\/v\d+$/.test(v) ? v : `${v}/api/v1`;
}

export const API_BASE_URL = resolveBase(
  (typeof import.meta !== "undefined"
    ? (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL
    : undefined) as string | undefined,
);

export class ApiError extends Error {
  status: number;
  data: unknown;
  /** Backend `error.code`, e.g. "payment_error". */
  code?: string;
  /** Field-level messages when `error.message` was an object. */
  fields?: Record<string, string>;
  constructor(message: string, status: number, data: unknown, code?: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.data = data;
    this.code = code;
    this.fields = fields;
  }
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  body?: unknown;
  params?: Record<string, string | number | boolean | null | undefined>;
  /** Send the stored token. Public catalog endpoints pass `false` so a stale token can't break browsing. */
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Reads `{ error: { code, message } }` (message may be a string or a { field: message } map). */
export function parseApiError(data: unknown, status: number) {
  const d = data as {
    error?: { code?: string; message?: unknown };
    detail?: string;
    message?: string;
  } | null;
  const e = d?.error;
  if (e) {
    if (typeof e.message === "string") return { message: e.message, code: e.code };
    if (e.message && typeof e.message === "object") {
      const fields = Object.fromEntries(
        Object.entries(e.message as Record<string, unknown>).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(" ") : String(v),
        ]),
      );
      return { message: Object.values(fields).join(" "), code: e.code, fields };
    }
  }
  return { message: d?.detail || d?.message || `HTTP ${status}`, code: e?.code, fields: undefined };
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, params, auth = true, headers: extra = {}, signal } = opts;

  const url = new URL(
    API_BASE_URL + path,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...extra,
  };
  if (auth && !headers["Authorization"]) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Token ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: isFormData ? (body as FormData) : body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0, null);
  }

  if (res.status === 204) return null as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const { message, code, fields } = parseApiError(data, res.status);
    throw new ApiError(message, res.status, data, code, fields);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, opts),
  post: <T>(path: string, opts?: RequestOptions) => request<T>("POST", path, opts),
  patch: <T>(path: string, opts?: RequestOptions) => request<T>("PATCH", path, opts),
  put: <T>(path: string, opts?: RequestOptions) => request<T>("PUT", path, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
};

/** Paginated list envelope used across the contract. */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Money as the server sends it (Decimal string) paired with display info. */
export interface MoneyInfo {
  code: string;
  symbol: string;
  decimal_places: number;
}
