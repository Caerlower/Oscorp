import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FullAnalysisResult } from "@/types/analysis-types";
import {
  companyProfileForApi,
  companyProfileStorageKey,
  competitorHost,
  displayTags,
  LEGACY_DEFAULT_COMPETITORS,
  normalizeTwitterHandle,
  readCompanyProfile,
  resolveTwitterHandle,
  setLatestCompanyProfileForAnalysis,
  writeCompanyProfile,
  type CompanyProfile,
} from "@/utils/company-profile";
import { useAnalysis } from "@/context/AnalysisContext";
import { useWorkspace } from "@/context/WorkspaceContext";

type CompanyProfileContextValue = {
  profile: CompanyProfile;
  displayTags: string[];
  twitterHandle: string;
  saveProfile: (next: CompanyProfile) => void;
  apiPayload: Record<string, unknown>;
  refreshFromAnalysis: () => void;
};

const CompanyProfileContext = createContext<CompanyProfileContextValue | null>(null);

export function CompanyProfileProvider({
  site,
  company,
  children,
}: {
  site: string;
  company: string;
  children: ReactNode;
}) {
  const { data: analysis } = useAnalysis();
  const { ready: workspaceReady, schedulePersist } = useWorkspace();
  const [profile, setProfile] = useState(() => readCompanyProfile(site, company));

  useEffect(() => {
    if (!workspaceReady) return;
    setProfile(readCompanyProfile(site, company));
  }, [site, company, workspaceReady]);

  useEffect(() => {
    if (!analysis?.company) return;
    const hasStored =
      typeof window !== "undefined" && localStorage.getItem(companyProfileStorageKey(site));
    setProfile((prev) => {
      const next = { ...prev };
      let changed = false;

      const twitter = normalizeTwitterHandle(analysis.socialTags?.twitterSite ?? "");
      if (!next.twitterHandle.trim() && twitter) {
        next.twitterHandle = twitter;
        changed = true;
      }

      const scoredCompetitors = (analysis.competitors ?? [])
        .filter((c) => typeof c.similarityScore === "number" && c.similarityScore >= 6)
        .map((c) => competitorHost(c.domain))
        .filter(Boolean);
      const profileUsesLegacyDefaults =
        next.competitors.length > 0 &&
        next.competitors.every((d) => LEGACY_DEFAULT_COMPETITORS.has(competitorHost(d)));

      if (!hasStored) {
        if (analysis.company?.description?.trim() && !next.description.trim()) {
          next.description = analysis.company.description.trim();
          changed = true;
        }
      }

      if (scoredCompetitors.length > 0) {
        const current = next.competitors.map((d) => competitorHost(d)).filter(Boolean);
        const same =
          current.length === scoredCompetitors.length &&
          current.every((d, i) => d === scoredCompetitors[i]);
        if (!same) {
          next.competitors = scoredCompetitors;
          changed = true;
        }
      } else if (
        (analysis.aiAnalysis?.status === "rate_limited" ||
          analysis.competitorsSource === "rate_limited" ||
          analysis.competitorsSource === "failed") &&
        profileUsesLegacyDefaults
      ) {
        next.competitors = [];
        changed = true;
      }

      if (changed) {
        writeCompanyProfile(site, next);
        schedulePersist({ company_profile: next });
      }
      return changed ? next : prev;
    });
  }, [analysis, site, schedulePersist]);

  const saveProfile = useCallback(
    (next: CompanyProfile) => {
      writeCompanyProfile(site, next);
      setProfile(next);
      schedulePersist({ company_profile: next });
    },
    [site, schedulePersist],
  );

  const tags = useMemo(() => displayTags(profile, analysis), [profile, analysis]);
  const twitterHandle = useMemo(() => resolveTwitterHandle(profile, analysis), [profile, analysis]);
  const apiPayload = useMemo(
    () => companyProfileForApi(profile, company, site, analysis),
    [profile, company, site, analysis],
  );

  useEffect(() => {
    setLatestCompanyProfileForAnalysis(apiPayload);
  }, [apiPayload]);

  const value: CompanyProfileContextValue = {
    profile,
    displayTags: tags,
    twitterHandle,
    saveProfile,
    apiPayload,
    refreshFromAnalysis: () => setProfile(readCompanyProfile(site, company)),
  };

  return <CompanyProfileContext.Provider value={value}>{children}</CompanyProfileContext.Provider>;
}

export function useCompanyProfile(): CompanyProfileContextValue {
  const ctx = useContext(CompanyProfileContext);
  if (!ctx) throw new Error("useCompanyProfile must be used within CompanyProfileProvider");
  return ctx;
}
