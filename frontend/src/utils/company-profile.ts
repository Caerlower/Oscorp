import type { FullAnalysisResult } from "@/types/analysis-types";
import { normalizeSiteUrl, siteLabel } from "@/utils/navigation";

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

function defaultProfile(_company: string, _site: string): CompanyProfile {
  return {
    description: "",
    tags: [],
    twitterHandle: "",
    linkedInUrl: "",
    competitors: [...DEFAULT_COMPETITORS],
    teamSize: "",
  };
}

/** Auto-generated onboarding placeholder — not a real summary. */
export function isPlaceholderDescription(
  description: string,
  company?: string,
  site?: string,
): boolean {
  const text = description.trim();
  if (!text) return true;
  if (/growth profile on/i.test(text)) return true;
  if (/^www(\s|\.)/i.test(text)) return true;

  const host = normalizeSiteUrl(site);
  const label = (company ?? "").trim().toLowerCase();
  if (label === "www" || label === "company") return true;

  if (host) {
    const variants = [
      `${label} growth profile on ${host}.`,
      `${label} growth profile on www.${host}.`,
      `${label} growth profile on https://${host}.`,
    ].map((s) => s.toLowerCase());
    if (variants.includes(text.toLowerCase())) return true;
  }
  return false;
}

function firstMarkdownParagraph(markdown: string): string {
  return markdown
    .replace(/^#+\s.*$/gm, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[0] ?? "";
}

/** Best available company summary for display (profile → analysis → crawl meta). */
export function resolveCompanySummary(
  profile: CompanyProfile,
  analysis: FullAnalysisResult | null | undefined,
  company: string,
  site: string,
): string {
  const manual = profile.description.trim();
  if (manual && !isPlaceholderDescription(manual, company, site)) {
    return manual;
  }

  const fromAnalysis = analysis?.company?.description?.trim();
  if (fromAnalysis && fromAnalysis.length >= 24) {
    return fromAnalysis;
  }

  const productBlurb = analysis?.documents?.productInfo
    ? firstMarkdownParagraph(analysis.documents.productInfo)
    : "";
  if (productBlurb.length >= 40) {
    return productBlurb;
  }

  const meta = analysis?.seo?.health?.metaDescription;
  if (meta?.present && meta.value?.trim().length >= 24) {
    return meta.value.trim();
  }

  const ogDescription = analysis?.socialTags?.ogDescription?.trim();
  if (ogDescription && ogDescription.length >= 24) {
    return ogDescription;
  }

  if (fromAnalysis) return fromAnalysis;

  return "";
}

export function resolveCompanyDisplayName(
  analysis: FullAnalysisResult | null | undefined,
  company: string,
  site: string,
): string {
  const raw = analysis?.company?.name?.trim();
  if (raw && raw.toLowerCase() !== "www" && !/^www\./i.test(raw)) {
    return raw;
  }
  const label = siteLabel(site);
  return label !== "Company" ? label : company;
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
      const storedDesc = parsed.description?.trim() ?? "";
      const description =
        storedDesc && !isPlaceholderDescription(storedDesc, company, site) ? storedDesc : "";
      return {
        description,
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
