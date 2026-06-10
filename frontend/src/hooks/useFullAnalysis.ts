import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { api } from "@/services/api";
import { getLatestCompanyProfileForAnalysis } from "@/utils/company-profile";
import type { AnalysisStatus, FullAnalysisResult } from "@/types/analysis-types";
import {
  readCachedAnalysis,
  readCachedAnalysisFallback,
  writeCachedAnalysis,
  isStaleAnalysisSchema,
  isGroqRateLimited,
  isGroqAnalysisComplete,
  shouldRetryGroqAnalysis,
  markGroqRetryAttempt,
  clearGroqRetryAttempt,
} from "@/types/analysis-types";
import { applyEditedDocumentsToAnalysis } from "@/utils/edited-documents";

const inflight = new Map<string, Promise<FullAnalysisResult>>();

/** Background poll while Groq daily cap is active. */
const GROQ_BACKGROUND_POLL_MS = 3 * 60 * 1000;

function mergeWithPriorCompleteDocs(
  result: FullAnalysisResult,
  prior: FullAnalysisResult | null,
): FullAnalysisResult {
  if (!isGroqRateLimited(result) || !prior || isGroqRateLimited(prior)) {
    return result;
  }
  const docs = prior.documents ?? {};
  const hasDocs = Object.values(docs).some((v) => typeof v === "string" && v.trim().length > 80);
  if (!hasDocs) return result;

  return {
    ...result,
    company: prior.company?.name ? prior.company : result.company,
    documents: docs,
    competitors: prior.competitors?.length ? prior.competitors : result.competitors,
    competitorsSource: prior.competitorsSource ?? result.competitorsSource,
    competitorsStatus: prior.competitorsStatus ?? result.competitorsStatus,
    aiAnalysis: {
      provider: "groq",
      status: "complete",
      message: null,
      retryAfterAt: null,
    },
  };
}

export function useFullAnalysis(site: string) {
  const { ready: workspaceReady, schedulePersist } = useWorkspace();
  const [data, setDataInternal] = useState<FullAnalysisResult | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const fetchLive = useCallback(
    async (options?: { bypassThrottle?: boolean }) => {
      if (!site.trim() || !workspaceReady) return;

      const bypassThrottle = options?.bypassThrottle ?? false;
      const throttleRef = dataRef.current ?? readCachedAnalysis(site);
      if (
        !bypassThrottle &&
        throttleRef &&
        isGroqRateLimited(throttleRef) &&
        !shouldRetryGroqAnalysis(throttleRef, site)
      ) {
        return;
      }

      const normalized = site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
      let pending = inflight.get(normalized);
      if (!pending) {
        markGroqRetryAttempt(site);
        pending = api.fullAnalysis(site, getLatestCompanyProfileForAnalysis()).finally(() => {
          inflight.delete(normalized);
        });
        inflight.set(normalized, pending);
      }

      const cached = readCachedAnalysis(site);
      const cachedMerged = cached ? applyEditedDocumentsToAnalysis(site, cached) : null;
      const hasDisplayData = Boolean(dataRef.current ?? cachedMerged);

      if (hasDisplayData) {
        setRefreshing(true);
      } else {
        setStatus("loading");
      }

      const priorComplete =
        dataRef.current && isGroqAnalysisComplete(dataRef.current)
          ? dataRef.current
          : cachedMerged && isGroqAnalysisComplete(cachedMerged)
            ? cachedMerged
            : readCachedAnalysisFallback(site);

      try {
        let result = applyEditedDocumentsToAnalysis(site, await pending);
        result = mergeWithPriorCompleteDocs(result, priorComplete);

        writeCachedAnalysis(site, result);
        if (isGroqAnalysisComplete(result)) {
          clearGroqRetryAttempt(site);
          schedulePersist({ analysis: result });
        }

        setDataInternal(result);
        setStatus("live");
        if (isGroqRateLimited(result) && result.aiAnalysis?.message) {
          setError(result.aiAnalysis.message);
        } else {
          setError(null);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Analysis failed";
        const fallback = readCachedAnalysisFallback(site) ?? dataRef.current ?? cachedMerged;
        if (fallback) {
          setDataInternal(applyEditedDocumentsToAnalysis(site, fallback));
          setStatus("live");
          setError(
            message.includes("Rate limit")
              ? "Using cached data (API rate limit)"
              : `Using cached data (${message})`,
          );
        } else {
          setError(message);
          setStatus("error");
        }
      } finally {
        setRefreshing(false);
      }
    },
    [site, workspaceReady, schedulePersist],
  );

  const hydrate = useCallback(async () => {
    if (!site.trim() || !workspaceReady) return;

    const cached = readCachedAnalysis(site);
    const cachedMerged = cached ? applyEditedDocumentsToAnalysis(site, cached) : null;

    if (cachedMerged && !isStaleAnalysisSchema(cachedMerged)) {
      setDataInternal(cachedMerged);
      setStatus("live");
      if (isGroqRateLimited(cachedMerged) && cachedMerged.aiAnalysis?.message) {
        setError(cachedMerged.aiAnalysis.message);
        await fetchLive({ bypassThrottle: true });
      } else {
        setError(null);
      }
      return;
    }

    await fetchLive({ bypassThrottle: true });
  }, [site, workspaceReady, fetchLive]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!workspaceReady || !site.trim() || !data || !isGroqRateLimited(data)) return;

    const attemptRefresh = () => {
      void fetchLive();
    };

    const intervalId = window.setInterval(attemptRefresh, GROQ_BACKGROUND_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") attemptRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [data, fetchLive, site, workspaceReady]);

  const patchData = useCallback(
    (updater: FullAnalysisResult | null | ((prev: FullAnalysisResult | null) => FullAnalysisResult | null)) => {
      setDataInternal((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        dataRef.current = next;
        return next;
      });
    },
    [],
  );

  return {
    data,
    status: workspaceReady ? status : "loading",
    refreshing,
    error,
    refresh: () => void fetchLive({ bypassThrottle: true }),
    patchData,
  };
}
