import { createContext, useCallback, useContext, type ReactNode } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useFullAnalysis } from "@/hooks/useFullAnalysis";
import type { AnalysisStatus, FullAnalysisResult } from "@/types/analysis-types";
import {
  patchAnalysisDocument,
  readEditedDocuments,
  writeEditedDocument,
  type DocumentKey,
} from "@/utils/edited-documents";

type AnalysisContextValue = {
  site: string;
  data: FullAnalysisResult | null;
  status: AnalysisStatus;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  updateDocument: (key: DocumentKey, markdown: string) => void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ site, children }: { site: string; children: ReactNode }) {
  const { schedulePersist } = useWorkspace();
  const { data, status, refreshing, error, refresh, patchData } = useFullAnalysis(site);

  const updateDocument = useCallback(
    (key: DocumentKey, markdown: string) => {
      patchData((prev) => {
        if (!prev) {
          writeEditedDocument(site, key, markdown);
          schedulePersist({ edited_documents: readEditedDocuments(site) });
          return prev;
        }
        const next = patchAnalysisDocument(site, prev, key, markdown);
        schedulePersist({
          edited_documents: readEditedDocuments(site),
          analysis: next,
        });
        return next;
      });
    },
    [site, patchData, schedulePersist],
  );

  return (
    <AnalysisContext.Provider value={{ site, data, status, refreshing, error, refresh, updateDocument }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error("useAnalysis must be used within AnalysisProvider");
  }
  return ctx;
}
