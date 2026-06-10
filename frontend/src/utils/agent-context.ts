import type { CompanyProfile } from "@/utils/company-profile";
import type { AgentContextPayload } from "@/types/agent-types";
import type { FullAnalysisResult } from "@/types/analysis-types";
import { competitorHost } from "@/utils/company-profile";

const FALLBACK_BRAND = "Clear, founder-led, conversational. No corporate jargon.";
const FALLBACK_STRATEGY = "SEO, community engagement (Reddit, X, LinkedIn), and thought leadership.";

function uniqueStrings(items: string[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

export function deriveKeywords(
  profile: CompanyProfile,
  analysis: FullAnalysisResult | null,
  company: string,
  site: string,
): string[] {
  const host = site.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const base = host.split(".")[0] ?? company;
  const fromTags = [
    ...profile.tags,
    ...(analysis?.company?.tags ?? []),
    analysis?.company?.category ?? "",
  ];
  const fromHeadings = [
    ...(analysis?.headings?.h1 ?? []),
    ...(analysis?.headings?.h2 ?? []).slice(0, 3),
  ];
  const fromIssues = (analysis?.seo?.issues ?? []).map((i) => i.category);
  return uniqueStrings(
    [
      company,
      base,
      "ai marketing",
      "growth",
      "seo",
      ...fromTags,
      ...fromHeadings,
      ...fromIssues,
      ...profile.competitors.map(competitorHost),
    ],
    10,
  );
}

export function buildAgentContext(
  profile: CompanyProfile,
  analysis: FullAnalysisResult | null,
  company: string,
  site: string,
): AgentContextPayload {
  const docs = analysis?.documents ?? {};
  const productInfo = (
    docs.productInfo?.trim() ||
    analysis?.company?.description?.trim() ||
    profile.description.trim() ||
    `${company} — ${site.replace(/^https?:\/\//, "")}`
  ).slice(0, 6000);

  const brandVoice = (docs.brandVoice?.trim() || FALLBACK_BRAND).slice(0, 4000);
  const marketingStrategy = (docs.marketingStrategy?.trim() || FALLBACK_STRATEGY).slice(0, 4000);
  const competitors =
    profile.competitors.length > 0
      ? profile.competitors
      : (analysis?.competitors?.map((c) => c.domain).filter(Boolean) ?? []);

  return {
    productInfo,
    brandVoice,
    marketingStrategy,
    competitors,
    keywords: deriveKeywords(profile, analysis, company, site),
  };
}

export function technicalDetailsForHn(
  analysis: FullAnalysisResult | null,
  productInfo: string,
  site: string,
): string {
  const tech = analysis?.technical;
  if (tech) {
    return [
      `Site: ${site}`,
      `On-page score: ${tech.onPageScore}`,
      `Server: ${tech.server.name} (${tech.server.status})`,
      `TTFB: ${tech.ttfb}ms`,
      `DOM size: ${tech.domSize}`,
    ].join("\n");
  }
  return productInfo.slice(0, 1500);
}
