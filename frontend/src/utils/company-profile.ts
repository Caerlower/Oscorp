import type { FullAnalysisResult } from "@/types/analysis-types";

export type CompanyProfile = {
  description: string;
  tags: string[];
  twitterHandle: string;
  linkedInUrl: string;
  competitors: string[];
  teamSize: string;
};

const PROFILE_KEY_PREFIX = "oscorp_company_profile:v1:";

export function companyProfileStorageKey(site: string): string {
  return profileKey(site);
}

let latestProfileForAnalysis: Record<string, unknown> | undefined;

export function setLatestCompanyProfileForAnalysis(payload: Record<string, unknown> | undefined): void {
  latestProfileForAnalysis = payload;
}

export function getLatestCompanyProfileForAnalysis(): Record<string, unknown> | undefined {
  return latestProfileForAnalysis;
}
const LEGACY_DESC_PREFIX = "oscorp_company_desc:";
const LEGACY_COMPETITORS_PREFIX = "oscorp_company_competitors:";

export const DEFAULT_COMPETITORS: string[] = [];

/** Legacy seeded defaults — replaced when fresh market-research competitors arrive. */
export const LEGACY_DEFAULT_COMPETITORS = new Set([
  "perawallet.app",
  "deflex.fi",
  "tinyman.org",
]);

function profileKey(site: string): string {
  return `${PROFILE_KEY_PREFIX}${site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()}`;
}

function defaultProfile(company: string, site: string): CompanyProfile {
  return {
    description: `${company} growth profile on ${site.replace(/^https?:\/\//, "")}.`,
    tags: [],
    twitterHandle: "",
    linkedInUrl: "",
    competitors: [...DEFAULT_COMPETITORS],
    teamSize: "",
  };
}

function migrateLegacy(site: string, base: CompanyProfile): CompanyProfile {
  if (typeof window === "undefined") return base;
  try {
    const desc = localStorage.getItem(`${LEGACY_DESC_PREFIX}${site}`);
    if (desc?.trim()) base.description = desc.trim();
    const compRaw = localStorage.getItem(`${LEGACY_COMPETITORS_PREFIX}${site}`);
    if (compRaw) {
      const parsed = JSON.parse(compRaw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        base.competitors = parsed.map(String);
      }
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function readCompanyProfile(site: string, company: string): CompanyProfile {
  const fallback = defaultProfile(company, site);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(profileKey(site));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CompanyProfile>;
      return {
        description: parsed.description?.trim() || fallback.description,
        tags: Array.isArray(parsed.tags) ? parsed.tags.filter(Boolean).map(String) : [],
        twitterHandle: parsed.twitterHandle?.trim() || "",
        linkedInUrl: parsed.linkedInUrl?.trim() || "",
        competitors:
          Array.isArray(parsed.competitors) && parsed.competitors.length > 0
            ? parsed.competitors.map(String)
            : fallback.competitors,
        teamSize: parsed.teamSize?.trim() || "",
      };
    }
  } catch {
    /* ignore */
  }
  return migrateLegacy(site, fallback);
}

export function writeCompanyProfile(site: string, profile: CompanyProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(profileKey(site), JSON.stringify(profile));
  localStorage.setItem(`${LEGACY_DESC_PREFIX}${site}`, profile.description);
  localStorage.setItem(`${LEGACY_COMPETITORS_PREFIX}${site}`, JSON.stringify(profile.competitors));
}

export function displayTags(profile: CompanyProfile, analysis?: FullAnalysisResult | null): string[] {
  const ogType = analysis?.socialTags?.ogType?.trim();
  const fromAnalysis = [
    ...(analysis?.company?.category ? [analysis.company.category] : []),
    ...(analysis?.company?.tags ?? []),
    ...(analysis?.metaKeywords ?? []),
    ...(ogType && !["website", "article"].includes(ogType.toLowerCase()) ? [ogType] : []),
  ];
  const manual = [...profile.tags];
  if (profile.teamSize.trim()) manual.unshift(`Team: ${profile.teamSize.trim()}`);
  const merged = [...manual, ...fromAnalysis];
  const seen = new Set<string>();
  return merged.filter((t) => {
    const k = t.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Twitter handle from saved profile or site metadata (twitter:site). */
export function resolveTwitterHandle(
  profile: CompanyProfile,
  analysis?: FullAnalysisResult | null,
): string {
  const fromProfile = normalizeTwitterHandle(profile.twitterHandle);
  if (fromProfile) return fromProfile;
  const fromMeta = (analysis?.socialTags?.twitterSite ?? "").trim().replace(/^@+/, "");
  return normalizeTwitterHandle(fromMeta);
}

export function resolveLinkedInUrl(
  profile: CompanyProfile,
  _analysis?: FullAnalysisResult | null,
): string {
  return normalizeLinkedInUrl(profile.linkedInUrl);
}

/** Payload sent to backend AI routes (growth cycle, analysis, etc.). */
export function companyProfileForApi(
  profile: CompanyProfile,
  company: string,
  site: string,
  analysis?: FullAnalysisResult | null,
): Record<string, unknown> {
  return {
    site,
    company_name: company,
    description: profile.description.trim(),
    tags: displayTags(profile, analysis),
    twitter_handle: resolveTwitterHandle(profile, analysis),
    linkedin_url: resolveLinkedInUrl(profile, analysis),
    competitors: profile.competitors,
    team_size: profile.teamSize.trim(),
  };
}

export function normalizeTwitterHandle(raw: string): string {
  return raw.replace(/^@+/, "").replace(/\s+/g, "").trim();
}

export function normalizeLinkedInUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.includes("linkedin.com")) return `https://${t.replace(/^\/+/, "")}`;
  return `https://linkedin.com/in/${t.replace(/^@+/, "")}`;
}

export function competitorHost(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .toLowerCase();
}
