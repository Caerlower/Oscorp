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
} from "@/types/analysis-types";
import { applyEditedDocumentsToAnalysis } from "@/utils/edited-documents";

const inflight = new Map<string, Promise<FullAnalysisResult>>();

export function useFullAnalysis(site: string) {
  const { ready: workspaceReady, schedulePersist } = useWorkspace();
  const [data, setDataInternal] = useState<FullAnalysisResult | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const run = useCallback(
    async (force = false) => {
      if (!site.trim() || !workspaceReady) return;

      if (!force) {
        const cached = readCachedAnalysis(site);
        if (cached && !isStaleAnalysisSchema(cached)) {
          const merged = applyEditedDocumentsToAnalysis(site, cached);
          setDataInternal(merged);
          setStatus("live");
          setError(null);
          return;
        }
      }

      const normalized = site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
      let pending = inflight.get(normalized);
      if (!pending) {
        pending = api.fullAnalysis(site, getLatestCompanyProfileForAnalysis()).finally(() => {
          inflight.delete(normalized);
        });
        inflight.set(normalized, pending);
      }

      setStatus("loading");
      setError(null);
      try {
        const result = applyEditedDocumentsToAnalysis(site, await pending);
        writeCachedAnalysis(site, result);
        schedulePersist({ analysis: result });
        setDataInternal(result);
        setStatus("live");
        if (result.aiAnalysis?.status === "rate_limited" && result.aiAnalysis.message) {
          setError(result.aiAnalysis.message);
        } else {
          setError(null);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Analysis failed";
        const fallback = readCachedAnalysisFallback(site) ?? dataRef.current;
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
      }
    },
    [site, workspaceReady, schedulePersist],
  );

  useEffect(() => {
    if (!workspaceReady || !site.trim()) return;
    void run(false);
  }, [run, site, workspaceReady]);

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
    error,
    refresh: () => void run(true),
    patchData,
  };
}
