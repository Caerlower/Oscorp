import type { FullAnalysisResult } from "@/types/analysis-types";
import { companyProfileForApi } from "@/utils/company-profile";
import type { CompanyProfile } from "@/utils/company-profile";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ContextMention = {
  id: string;
  label: string;
  insert: string;
  description: string;
};

export const CHAT_CONTEXT_MENTIONS: ContextMention[] = [
  {
    id: "product-info",
    label: "Product info",
    insert: "@product-info ",
    description: "Product overview and positioning doc",
  },
  {
    id: "brand-voice",
    label: "Brand voice",
    insert: "@brand-voice ",
    description: "Tone and messaging guidelines",
  },
  {
    id: "marketing-strategy",
    label: "Marketing strategy",
    insert: "@marketing-strategy ",
    description: "Channel plan and growth playbook",
  },
  {
    id: "seo",
    label: "SEO analysis",
    insert: "@seo ",
    description: "PageSpeed scores and on-page issues",
  },
  {
    id: "competitors",
    label: "Competitors",
    insert: "@competitors ",
    description: "Competitive landscape from analysis",
  },
  {
    id: "articles",
    label: "Articles",
    insert: "@articles ",
    description: "Saved article drafts and ideas",
  },
];

export function buildCmoChatPayload(
  company: string,
  site: string,
  profile: CompanyProfile,
  analysis: FullAnalysisResult | null,
) {
  return {
    site,
    company_name: analysis?.company?.name ?? company,
    company_profile: companyProfileForApi(profile, company, site, analysis),
    analysis: analysis ?? null,
  };
}

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

const MAX_ACTIVE_MESSAGES = 40;
const MAX_ARCHIVED_SESSIONS = 30;

function normalizeSite(site: string): string {
  return site.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
}

export function chatStorageKey(site: string): string {
  return `oscorp_cmo_chat_active:v1:${normalizeSite(site)}`;
}

export function chatSessionsStorageKey(site: string): string {
  return `oscorp_cmo_chat_sessions:v1:${normalizeSite(site)}`;
}

/** @deprecated legacy key — migrated on first read */
function legacyChatStorageKey(site: string): string {
  return `oscorp_cmo_chat:${normalizeSite(site)}`;
}

export function sessionTitleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (firstUser?.content.trim()) {
    const text = firstUser.content.trim().replace(/\s+/g, " ");
    return text.length > 56 ? `${text.slice(0, 56)}…` : text;
  }
  const stamp = messages[0]?.createdAt;
  if (stamp) {
    return `Chat · ${new Date(stamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
  }
  return "Untitled chat";
}

export function readChatSessions(site: string): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(chatSessionsStorageKey(site));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && Array.isArray(s.messages) && s.messages.length > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

function writeChatSessions(site: string, sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    chatSessionsStorageKey(site),
    JSON.stringify(sessions.slice(0, MAX_ARCHIVED_SESSIONS)),
  );
}

export function archiveChatSession(site: string, messages: ChatMessage[]): ChatSession | null {
  if (!messages.length) return null;
  const trimmed = messages.slice(-MAX_ACTIVE_MESSAGES);
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: sessionTitleFromMessages(trimmed),
    messages: trimmed,
    createdAt: trimmed[0]?.createdAt ?? now,
    updatedAt: trimmed[trimmed.length - 1]?.createdAt ?? now,
  };
  const existing = readChatSessions(site);
  writeChatSessions(site, [session, ...existing]);
  return session;
}

export function readChatHistory(site: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const activeRaw = localStorage.getItem(chatStorageKey(site));
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw) as ChatMessage[];
      if (Array.isArray(parsed)) return parsed;
    }
    const legacyRaw = localStorage.getItem(legacyChatStorageKey(site));
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw) as ChatMessage[];
    if (!Array.isArray(legacy) || legacy.length === 0) return [];
    writeChatHistory(site, legacy);
    localStorage.removeItem(legacyChatStorageKey(site));
    return legacy;
  } catch {
    return [];
  }
}

export function writeChatHistory(site: string, messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(chatStorageKey(site), JSON.stringify(messages.slice(-MAX_ACTIVE_MESSAGES)));
}

export function loadChatSession(site: string, sessionId: string): ChatMessage[] {
  const session = readChatSessions(site).find((s) => s.id === sessionId);
  return session?.messages ?? [];
}

export function deleteChatSession(site: string, sessionId: string): void {
  writeChatSessions(
    site,
    readChatSessions(site).filter((s) => s.id !== sessionId),
  );
}

export function newChatMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}
