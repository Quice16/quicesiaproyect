/**
 * Cliente HTTP minimalista para el backend Railway.
 * Lee la base URL de VITE_API_URL (definida por el deploy de Vercel o .env local).
 */

// Fallback al backend en Railway si VITE_API_URL no está definida en el deploy.
// Cambia esta constante si reapuntas el backend a otra URL.
const DEFAULT_API_URL = "https://backend-production-f96d.up.railway.app";

const RAW_API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  DEFAULT_API_URL;

// Quitamos slashes finales para concatenar limpio.
const API_URL = RAW_API_URL.replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export interface ApiResponse<T> {
  data: T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      "El frontend no tiene VITE_API_URL configurado. Define la variable en .env (local) o en las settings de Vercel (producción).",
      0
    );
  }

  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;

  // Lazy import para evitar ciclo lib/api ← lib/auth ← lib/api.
  let token: string | null = null;
  try {
    token = localStorage.getItem("quicesia_jwt_v1");
  } catch {
    /* noop */
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
    });
  } catch (err) {
    throw new ApiError(
      `No se pudo conectar al backend (${url}). ¿Está vivo el servicio en Railway? Detalle: ${
        err instanceof Error ? err.message : String(err)
      }`,
      0
    );
  }

  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : null) ||
      (typeof body === "string" ? body : null) ||
      `Error ${response.status}`;
    throw new ApiError(
      message,
      response.status,
      body && typeof body === "object" && "details" in body ? body.details : undefined
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, payload: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(payload) }),
  patch: <T>(path: string, payload: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(payload) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const apiBaseUrl = API_URL;
