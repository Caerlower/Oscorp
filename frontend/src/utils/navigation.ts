import type { SessionConnect } from "@/services/api";
import { sessionHomePath } from "@/services/auth";

/** In-app paths users may be redirected to after sign-in. */
export const APP_PATHS = ["/dashboard", "/profile", "/settings"] as const;

export type AppPath = (typeof APP_PATHS)[number];

/** Per-wallet site cache (scoped by Algorand address). */
const SITE_STORAGE_PREFIX = "oscorp_site:";
/** Pre-auth marketing flow only — never used to skip onboarding. */
const PENDING_SITE_KEY = "oscorp_pending_site";
/** @deprecated Legacy global key — cleared on wallet switch. */
const LEGACY_SITE_STORAGE_KEY = "oscorp_site";

export const PLACEHOLDER_SITE = "yourcompany.com";

type NavigateFn = (opts: { to: AppPath; replace?: boolean }) => void;

function walletSiteKey(walletAddress: string): string {
  return `${SITE_STORAGE_PREFIX}${walletAddress.toUpperCase()}`;
}

/** Strip query/hash and validate redirect targets — never returns undefined. */
export function normalizeRedirectPath(
  redirect?: string | null,
  fallback: AppPath = "/dashboard",
): AppPath {
  if (!redirect || typeof redirect !== "string") return fallback;

  try {
    const decoded = decodeURIComponent(redirect.trim());
    const path = decoded.split("?")[0]?.split("#")[0]?.trim() ?? "";
    if (path.startsWith("/") && (APP_PATHS as readonly string[]).includes(path)) {
      return path as AppPath;
    }
  } catch {
    /* malformed encoding */
  }

  return fallback;
}

/** Safe post-auth navigation — pathname only (site lives in sessionStorage). */
export function navigateAfterAuth(
  navigate: NavigateFn,
  session: SessionConnect,
  redirect?: string,
  replace = false,
) {
  const fallback = sessionHomePath();
  const to = redirect && redirect !== "/auth" ? normalizeRedirectPath(redirect, fallback) : fallback;
  navigate({ to, replace });
}

/** Normalize a website URL for storage/display. Returns empty string when missing. */
export function normalizeSiteUrl(raw?: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .replace(/^www\./i, "");
}

export function isValidSite(site?: string | null): boolean {
  const normalized = normalizeSiteUrl(site);
  if (!normalized) return false;
  if (normalized.toLowerCase() === PLACEHOLDER_SITE) return false;
  return normalized.includes(".");
}

export function siteLabel(site: string | null | undefined): string {
  if (!site || !isValidSite(site)) return "Company";
  const host = normalizeSiteUrl(site);
  const label = host.split(".")[0] ?? "";
  if (!label) return "Company";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Site saved for this wallet only (not shared across accounts). */
export function readStoredSite(walletAddress?: string | null): string | null {
  if (typeof window === "undefined" || !walletAddress) return null;
  const normalized = normalizeSiteUrl(sessionStorage.getItem(walletSiteKey(walletAddress)));
  return isValidSite(normalized) ? normalized : null;
}

export function storeSite(url: string, walletAddress: string): boolean {
  const normalized = normalizeSiteUrl(url);
  if (!isValidSite(normalized) || typeof window === "undefined") return false;
  sessionStorage.setItem(walletSiteKey(walletAddress), normalized);
  sessionStorage.removeItem(LEGACY_SITE_STORAGE_KEY);
  return true;
}

/** Pre-auth URL from marketing hero — applied only when user explicitly saves in onboarding. */
export function storePendingSite(url: string): boolean {
  const normalized = normalizeSiteUrl(url);
  if (!isValidSite(normalized) || typeof window === "undefined") return false;
  sessionStorage.setItem(PENDING_SITE_KEY, normalized);
  return true;
}

export function readPendingSite(): string | null {
  if (typeof window === "undefined") return null;
  const normalized = normalizeSiteUrl(sessionStorage.getItem(PENDING_SITE_KEY));
  return isValidSite(normalized) ? normalized : null;
}

export function clearPendingSite(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_SITE_KEY);
}

export function clearStoredSite(walletAddress?: string | null): void {
  if (typeof window === "undefined") return;
  if (walletAddress) {
    sessionStorage.removeItem(walletSiteKey(walletAddress));
  }
  sessionStorage.removeItem(LEGACY_SITE_STORAGE_KEY);
  sessionStorage.removeItem(PENDING_SITE_KEY);
}

/** Remove legacy global site keys so a new login never inherits another account's URL. */
export function clearLegacySiteStorage(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LEGACY_SITE_STORAGE_KEY);
}
