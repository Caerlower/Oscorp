import type { FullAnalysisResult } from "@/types/analysis-types";
import {
  readCachedAnalysis,
  writeCachedAnalysis,
} from "@/types/analysis-types";
import {
  readChatHistory,
  readChatSessions,
  writeChatHistory,
  chatSessionsStorageKey,
  type ChatMessage,
  type ChatSession,
} from "@/utils/chat-context";
import type { CompanyProfile } from "@/utils/company-profile";
import { companyProfileStorageKey } from "@/utils/company-profile";
import { readEditedDocuments, type DocumentKey } from "@/utils/edited-documents";
import { normalizeSiteUrl } from "@/utils/navigation";
import { api } from "@/services/api";

export type WorkspaceRecord = {
  user_id: string;
  site_url: string;
  analysis: FullAnalysisResult | null;
  company_profile: CompanyProfile | Record<string, unknown>;
  edited_documents: Partial<Record<DocumentKey, string>>;
  chat_active_messages: ChatMessage[];
  chat_archived_sessions: ChatSession[];
  analysis_updated_at?: string | null;
  updated_at?: string | null;
};

export type WorkspacePatch = Partial<
  Pick<
    WorkspaceRecord,
    | "analysis"
    | "company_profile"
    | "edited_documents"
    | "chat_active_messages"
    | "chat_archived_sessions"
  >
>;

export function workspaceSiteHost(site: string): string {
  const normalized = normalizeSiteUrl(site);
  if (!normalized) return site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  return normalized.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
}

function readProfileFromLocal(site: string): CompanyProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(companyProfileStorageKey(site));
    if (!raw) return null;
    return JSON.parse(raw) as CompanyProfile;
  } catch {
    return null;
  }
}

function writeProfileToLocal(site: string, profile: CompanyProfile): void {
  localStorage.setItem(companyProfileStorageKey(site), JSON.stringify(profile));
}

function writeEditedDocsToLocal(site: string, docs: Partial<Record<DocumentKey, string>>): void {
  const key = `oscorp_edited_docs:v1:${workspaceSiteHost(site)}`;
  localStorage.setItem(key, JSON.stringify(docs));
}

function writeChatSessionsToLocal(site: string, sessions: ChatSession[]): void {
  localStorage.setItem(chatSessionsStorageKey(site), JSON.stringify(sessions.slice(0, 30)));
}

export function collectLocalWorkspace(site: string): WorkspacePatch {
  return {
    analysis: readCachedAnalysis(site),
    company_profile: readProfileFromLocal(site) ?? undefined,
    edited_documents: readEditedDocuments(site),
    chat_active_messages: readChatHistory(site),
    chat_archived_sessions: readChatSessions(site),
  };
}

function hasAnalysis(data: FullAnalysisResult | null | undefined): boolean {
  return Boolean(data?.domain && data?.analyzedAt);
}

export function hasWorkspaceContent(patch: WorkspacePatch): boolean {
  return (
    hasAnalysis(patch.analysis ?? null) ||
    Boolean(patch.company_profile && Object.keys(patch.company_profile).length > 0) ||
    Boolean(patch.edited_documents && Object.keys(patch.edited_documents).length > 0) ||
    Boolean(patch.chat_active_messages && patch.chat_active_messages.length > 0) ||
    Boolean(patch.chat_archived_sessions && patch.chat_archived_sessions.length > 0)
  );
}

export function hasRemoteWorkspace(record: WorkspaceRecord | null | undefined): boolean {
  if (!record) return false;
  return hasWorkspaceContent({
    analysis: record.analysis,
    company_profile: record.company_profile as CompanyProfile,
    edited_documents: record.edited_documents,
    chat_active_messages: record.chat_active_messages,
    chat_archived_sessions: record.chat_archived_sessions,
  });
}

export function applyWorkspaceToLocal(site: string, record: WorkspacePatch): void {
  if (record.analysis && hasAnalysis(record.analysis)) {
    writeCachedAnalysis(site, record.analysis);
  }
  if (record.company_profile && typeof record.company_profile === "object") {
    writeProfileToLocal(site, record.company_profile as CompanyProfile);
  }
  if (record.edited_documents && Object.keys(record.edited_documents).length > 0) {
    writeEditedDocsToLocal(site, record.edited_documents);
  }
  if (Array.isArray(record.chat_active_messages)) {
    writeChatHistory(site, record.chat_active_messages);
  }
  if (Array.isArray(record.chat_archived_sessions)) {
    writeChatSessionsToLocal(site, record.chat_archived_sessions);
  }
}

export async function fetchRemoteWorkspace(
  userId: string,
  site: string,
): Promise<WorkspaceRecord | null> {
  try {
    const row = await api.getWorkspace(userId, workspaceSiteHost(site));
    return {
      user_id: row.user_id,
      site_url: row.site_url,
      analysis: (row.analysis as FullAnalysisResult | null) ?? null,
      company_profile: (row.company_profile as CompanyProfile) ?? {},
      edited_documents: (row.edited_documents as Partial<Record<DocumentKey, string>>) ?? {},
      chat_active_messages: (row.chat_active_messages as ChatMessage[]) ?? [],
      chat_archived_sessions: (row.chat_archived_sessions as ChatSession[]) ?? [],
      analysis_updated_at: row.analysis_updated_at ?? null,
      updated_at: row.updated_at ?? null,
    };
  } catch {
    return null;
  }
}

export async function pushRemoteWorkspace(
  userId: string,
  site: string,
  patch: WorkspacePatch,
): Promise<void> {
  if (!hasWorkspaceContent(patch)) return;
  try {
    await api.saveWorkspace(userId, {
      site_url: workspaceSiteHost(site),
      ...patch,
    });
  } catch {
    /* local cache remains source of truth until next successful sync */
  }
}

export function mergeWorkspacePatches(...patches: WorkspacePatch[]): WorkspacePatch {
  const merged: WorkspacePatch = {};
  for (const patch of patches) {
    if (patch.analysis && hasAnalysis(patch.analysis)) merged.analysis = patch.analysis;
    if (patch.company_profile) merged.company_profile = patch.company_profile;
    if (patch.edited_documents) merged.edited_documents = patch.edited_documents;
    if (patch.chat_active_messages) merged.chat_active_messages = patch.chat_active_messages;
    if (patch.chat_archived_sessions) merged.chat_archived_sessions = patch.chat_archived_sessions;
  }
  return merged;
}
