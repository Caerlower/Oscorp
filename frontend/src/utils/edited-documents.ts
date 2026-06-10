import type { FullAnalysisResult } from "@/types/analysis-types";
import { writeCachedAnalysis } from "@/types/analysis-types";

const PREFIX = "oscorp_edited_docs:v1:";

function storageKey(site: string): string {
  return `${PREFIX}${site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase()}`;
}

export type DocumentKey = keyof FullAnalysisResult["documents"];

export function readEditedDocuments(site: string): Partial<Record<DocumentKey, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(site));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<DocumentKey, string>>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function writeEditedDocument(site: string, key: DocumentKey, markdown: string): void {
  if (typeof window === "undefined") return;
  const prev = readEditedDocuments(site);
  localStorage.setItem(
    storageKey(site),
    JSON.stringify({ ...prev, [key]: markdown }),
  );
}

export function applyEditedDocumentsToAnalysis(
  site: string,
  data: FullAnalysisResult,
): FullAnalysisResult {
  const edits = readEditedDocuments(site);
  if (!Object.keys(edits).length) return data;
  return {
    ...data,
    documents: { ...data.documents, ...edits },
  };
}

export function getDocumentMarkdown(
  site: string,
  key: DocumentKey,
  fromAnalysis?: string | null,
): string {
  const edited = readEditedDocuments(site)[key];
  if (edited?.trim()) return edited.trim();
  return (fromAnalysis ?? "").trim();
}

/** Apply user edits onto cached analysis and persist. */
export function patchAnalysisDocument(
  site: string,
  data: FullAnalysisResult,
  key: DocumentKey,
  markdown: string,
): FullAnalysisResult {
  writeEditedDocument(site, key, markdown);
  const next: FullAnalysisResult = {
    ...data,
    documents: { ...data.documents, [key]: markdown },
  };
  writeCachedAnalysis(site, next);
  return next;
}

export function downloadTextFile(filename: string, text: string, mime = "text/markdown;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugifyFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `${slug}.md` : "document.md";
}
