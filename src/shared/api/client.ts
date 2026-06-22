/**
 * Typed HTTP client for the external Sonny API.
 * Base URL is configurable via VITE_API_BASE_URL.
 * Token is read from localStorage (browser only) — see auth store.
 */

const TOKEN_KEY = "studio_token";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
      ?.VITE_API_BASE_URL) ||
  "http://127.0.0.1:8000/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
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
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request<T>(
  method: Method,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { body, params, auth = true, headers: extraHeaders = {}, signal } = opts;

  const url = new URL(
    API_BASE_URL + path,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  // When body is FormData the browser must set Content-Type itself so it can
  // include the multipart boundary. Never force JSON in that case.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...extraHeaders,
  };

  if (auth) {
    const token = getStoredToken();
    if (token) headers["Authorization"] = `Token ${token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: isFormData
      ? body
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
    signal,
  });

  if (res.status === 204) return null as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const d = data as {
      detail?: string;
      message?: string;
      error?: { message?: string; code?: string; details?: Record<string, string[]> };
      errors?: Array<{ message?: string }> | Record<string, string[]>;
      non_field_errors?: string[];
    } | null;

    const msg =
      // Sonny API envelope: { error: { message } }
      d?.error?.message ||
      // DRF field validation details: { error: { details: { field: ["msg"] } } }
      (d?.error?.details
        ? Object.values(d.error.details).flat().join(" ")
        : undefined) ||
      // DRF standard: { detail: "..." }
      d?.detail ||
      // Top-level message
      d?.message ||
      // DRF non-field errors: { non_field_errors: ["..."] }
      d?.non_field_errors?.[0] ||
      // DRF field errors dict: { field: ["msg"] }
      (d && !d.error && !d.detail && !d.message
        ? Object.values(d as Record<string, unknown>)
            .flat()
            .find((v) => typeof v === "string") as string | undefined
        : undefined) ||
      `HTTP ${res.status}`;

    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>("GET", path, opts),
  post: <T>(path: string, opts?: RequestOptions) =>
    request<T>("POST", path, opts),
  patch: <T>(path: string, opts?: RequestOptions) =>
    request<T>("PATCH", path, opts),
  put: <T>(path: string, opts?: RequestOptions) =>
    request<T>("PUT", path, opts),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>("DELETE", path, opts),
};