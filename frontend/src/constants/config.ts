const envUrl = (import.meta.env.VITE_API_URL ?? "").trim();

/**
 * Backend API base URL. In dev, call :8000 directly (CORS is enabled on the backend).
 * Avoids Vite proxy timing issues when the API starts after the frontend.
 */
function resolveApiUrl(): string {
  const base = envUrl || "http://127.0.0.1:8000";
  return base.replace(/\/$/, "");
}

export const API_URL = resolveApiUrl();
