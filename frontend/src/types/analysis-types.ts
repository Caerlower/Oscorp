export type VitalMetric = { value: string; status: "pass" | "warn" | "fail" };

export type PageSpeedScores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
};

export type SeoIssue = {
  type: string;
  message: string;
  impact: string;
  category: string;
};

export type Competitor = {
  name: string;
  domain: string;
  description?: string;
  strengths?: string[];
  faviconUrl?: string;
  similarityScore?: number;
  competitorType?: "direct" | "indirect" | "emerging";
};

export type FullAnalysisResult = {
  domain: string;
  requestedUrl?: string;
  analyzedUrl?: string;
  analyzedAt: string;
  company: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
  };
  documents: {
    productInfo?: string;
    competitorAnalysis?: string;
    brandVoice?: string;
    marketingStrategy?: string;
    llmsTxt?: string;
    articles?: string;
  };
  competitors: Competitor[];
  competitorsSource?: string;
  competitorsStatus?: "complete" | "empty" | "failed" | "rate_limited";
  seo: {
    pagespeed: { mobile: PageSpeedScores; desktop: PageSpeedScores };
    coreWebVitals: { desktop: Record<string, VitalMetric>; mobile: Record<string, VitalMetric> };
    health: {
      metaDescription: { present: boolean; value: string; length?: number };
      canonicalUrl: { present: boolean; value: string };
      language: { present: boolean; value: string };
      mobileFriendly: boolean;
      wordCount: number;
      readability: string;
    };
    issues: SeoIssue[];
    lighthouseVersion?: string;
  };
  technical: {
    onPageScore: number;
    server: {
      name: string;
      status: number;
      encoding: string;
      pageSize: string;
      domSize: string;
      cacheable: boolean;
    };
    serverTiming: Record<string, VitalMetric>;
    renderBlocking: { blockingScripts: number; blockingStylesheets: number; urls: string[] };
    ttfb: number;
    domSize: number;
  };
  contentRelevance: Record<string, number>;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  socialTags: Record<string, string>;
  metaKeywords?: string[];
  scrapeSource?: string;
  aiAnalysis?: {
    provider: string;
    status: "complete" | "rate_limited";
    message?: string | null;
    /** ISO timestamp — earliest time to retry Groq (from API error). */
    retryAfterAt?: string | null;
  };
};

export type AnalysisStatus = "idle" | "loading" | "live" | "error";

const CACHE_PREFIX = "oscorp-full-analysis:v8:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(site: string): string {
  return `${CACHE_PREFIX}${site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()}`;
}

/** Old API only fetched performance — treat zeroed secondary scores as stale. */
export function isIncompletePagespeed(data: FullAnalysisResult): boolean {
  for (const strategy of [data.seo?.pagespeed?.mobile, data.seo?.pagespeed?.desktop]) {
    if (!strategy) continue;
    const { performance, accessibility, bestPractices, seo } = strategy;
    if (performance > 0 && accessibility === 0 && bestPractices === 0 && seo === 0) {
      return true;
    }
  }
  return false;
}

const DOC_KEYS: (keyof FullAnalysisResult["documents"])[] = [
  "productInfo",
  "competitorAnalysis",
  "brandVoice",
  "marketingStrategy",
  "llmsTxt",
  "articles",
];

/** v7+ documents are long-form markdown strings with section headings. */
export function isStaleDocuments(data: FullAnalysisResult): boolean {
  const docs = data.documents as Record<string, unknown> | undefined;
  if (!docs) return false;
  for (const key of DOC_KEYS) {
    const v = docs[key];
    if (v == null || v === "") continue;
    if (typeof v !== "string") return true;
    if (!v.includes("##") && v.length > 80) return true;
  }
  return false;
}

/** Pre-v8 analyses used page-mentioned brands or hardcoded Algorand defaults as competitors. */
export function isStaleCompetitors(data: FullAnalysisResult): boolean {
  const comps = data.competitors ?? [];
  if (comps.length === 0) return false;
  return comps.every((c) => typeof c.similarityScore !== "number");
}

/** Minimum gap between Groq retry attempts (per site, per tab session). */
export const GROQ_RETRY_MIN_MS = 2 * 60 * 1000;

const GROQ_RETRY_PREFIX = "oscorp_groq_retry:";

export function isGroqRateLimited(data: FullAnalysisResult): boolean {
  return data.aiAnalysis?.status === "rate_limited";
}

export function isGroqAnalysisComplete(data: FullAnalysisResult): boolean {
  return data.aiAnalysis?.status === "complete";
}

function groqRetryStorageKey(site: string): string {
  return `${GROQ_RETRY_PREFIX}${site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()}`;
}

export function readLastGroqRetryAt(site: string): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(groqRetryStorageKey(site));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function markGroqRetryAttempt(site: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(groqRetryStorageKey(site), String(Date.now()));
}

export function clearGroqRetryAttempt(site: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(groqRetryStorageKey(site));
}

/** True when we should hit the API again to see if Groq quota is back. */
export function shouldRetryGroqNow(site: string): boolean {
  const last = readLastGroqRetryAt(site);
  if (!last) return true;
  return Date.now() - last >= GROQ_RETRY_MIN_MS;
}

/** Respect Groq's own retry-after timestamp when present on cached analysis. */
export function shouldRetryGroqAnalysis(data: FullAnalysisResult, site: string): boolean {
  const retryAt = data.aiAnalysis?.retryAfterAt;
  if (retryAt) {
    const at = Date.parse(retryAt);
    if (Number.isFinite(at) && Date.now() < at) return false;
  }
  return shouldRetryGroqNow(site);
}

/** Prefer complete AI analysis over rate-limited snapshots when merging workspaces. */
export function pickPreferredAnalysis(
  local: FullAnalysisResult | null | undefined,
  remote: FullAnalysisResult | null | undefined,
): FullAnalysisResult | null {
  if (!local) return remote ?? null;
  if (!remote) return local;

  const localLimited = isGroqRateLimited(local);
  const remoteLimited = isGroqRateLimited(remote);
  if (!localLimited && remoteLimited) return local;
  if (localLimited && !remoteLimited) return remote;

  const localAt = Date.parse(local.analyzedAt ?? "");
  const remoteAt = Date.parse(remote.analyzedAt ?? "");
  if (Number.isFinite(localAt) && Number.isFinite(remoteAt)) {
    return localAt >= remoteAt ? local : remote;
  }
  return localLimited ? remote : local;
}

/** v8 schema: market-research competitors with similarity scores. */
export function isStaleAnalysisSchema(data: FullAnalysisResult): boolean {
  if (isIncompletePagespeed(data)) return true;
  if (!data.analyzedUrl) return true;
  if (!data.technical?.serverTiming || Object.keys(data.technical.serverTiming).length === 0) return true;
  if (data.seo?.health?.readability === undefined) return true;
  if (data.seo?.health?.mobileFriendly === undefined) return true;
  const rel = data.contentRelevance;
  if (!rel || rel.titleRelevance === undefined) return true;
  if (rel.titleRelevance > 0 && rel.titleRelevance < 15 && (rel.contentRate ?? 0) > 50) return true;
  const issues = data.seo?.issues ?? [];
  if (issues.some((i) => i.message === "Reduce unused JavaScript")) return true;
  if (isStaleDocuments(data)) return true;
  if (data.metaKeywords === undefined) return true;
  if (isStaleCompetitors(data)) return true;
  return false;
}

export function readCachedAnalysis(site: string): FullAnalysisResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(site));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: FullAnalysisResult };
    if (Date.now() - parsed.at > CACHE_TTL_MS) {
      return null;
    }
    if (isStaleAnalysisSchema(parsed.data)) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

/** Return last cached analysis even if schema is stale — used when live fetch fails. */
export function readCachedAnalysisFallback(site: string): FullAnalysisResult | null {
  if (typeof window === "undefined") return null;
  const normalized = site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  const keys = [
    cacheKey(site),
    `oscorp-full-analysis:v6:${normalized}`,
    `oscorp-full-analysis:v5:${normalized}`,
    `oscorp-full-analysis:v4:${normalized}`,
    `oscorp-full-analysis:v3:${normalized}`,
  ];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { at: number; data: FullAnalysisResult };
      if (Date.now() - parsed.at > CACHE_TTL_MS) continue;
      if (parsed.data?.seo?.pagespeed?.desktop?.performance) {
        return parsed.data;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function writeCachedAnalysis(site: string, data: FullAnalysisResult): void {
  if (typeof window === "undefined") return;
  const normalized = site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  try {
    localStorage.removeItem(`oscorp-full-analysis:${normalized}`);
    localStorage.removeItem(`oscorp-full-analysis:v2:${normalized}`);
    localStorage.removeItem(`oscorp-full-analysis:v3:${normalized}`);
    localStorage.removeItem(`oscorp-full-analysis:v4:${normalized}`);
    localStorage.removeItem(`oscorp-full-analysis:v5:${normalized}`);
    localStorage.removeItem(`oscorp-full-analysis:v6:${normalized}`);
    localStorage.removeItem(`oscorp-full-analysis:v7:${normalized}`);
  } catch {
    /* ignore */
  }
  localStorage.setItem(cacheKey(site), JSON.stringify({ at: Date.now(), data }));
}

export function scoreColor(value: number): "emerald" | "amber" {
  return value >= 70 ? "emerald" : "amber";
}

export function vitalOk(status: string | undefined): boolean {
  return status === "pass";
}

export function vitalLabel(status: string | undefined): string {
  if (status === "pass") return "Pass";
  if (status === "fail") return "Fail";
  return "Warn";
}

export const DOC_MARKDOWN_KEYS: Record<string, keyof FullAnalysisResult["documents"]> = {
  "doc:product-information": "productInfo",
  "doc:competitor-analysis": "competitorAnalysis",
  "doc:brand-voice": "brandVoice",
  "doc:marketing-strategy": "marketingStrategy",
  "doc:llms-txt": "llmsTxt",
  "doc:articles": "articles",
};
