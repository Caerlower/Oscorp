import { useCallback, useEffect, useRef, useState } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useCompanyProfile } from "@/context/CompanyProfileContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { api } from "@/services/api";
import {
  archiveChatSession,
  buildCmoChatPayload,
  deleteChatSession,
  loadChatSession,
  newChatMessage,
  readChatHistory,
  readChatSessions,
  writeChatHistory,
  type ChatMessage,
  type ChatSession,
} from "@/utils/chat-context";

export function useCmoChat(company: string, site: string) {
  const { data: analysis } = useAnalysis();
  const { profile } = useCompanyProfile();
  const { ready: workspaceReady, schedulePersist } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const refreshSessions = useCallback(() => {
    setSessions(readChatSessions(site));
  }, [site]);

  const persistChat = useCallback(
    (nextMessages: ChatMessage[], nextSessions: ChatSession[]) => {
      schedulePersist({
        chat_active_messages: nextMessages,
        chat_archived_sessions: nextSessions,
      });
    },
    [schedulePersist],
  );

  useEffect(() => {
    if (!workspaceReady) return;
    setMessages(readChatHistory(site));
    refreshSessions();
    setHydrated(true);
  }, [site, workspaceReady, refreshSessions]);

  useEffect(() => {
    if (!hydrated) return;
    writeChatHistory(site, messages);
    persistChat(messages, sessions);
  }, [messages, sessions, site, hydrated, persistChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;

      const userMsg = newChatMessage("user", text);
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const payload = buildCmoChatPayload(company, site, profile, analysis);
        const { reply } = await api.cmoChat({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          ...payload,
        });
        setMessages((prev) => [...prev, newChatMessage("assistant", reply)]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chat request failed";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [analysis, company, loading, messages, profile, site],
  );

  const clear = useCallback(() => {
    if (messages.length > 0) {
      archiveChatSession(site, messages);
      refreshSessions();
    }
    setMessages([]);
    setError(null);
    writeChatHistory(site, []);
    persistChat([], readChatSessions(site));
  }, [messages, persistChat, refreshSessions, site]);

  const restoreSession = useCallback(
    (sessionId: string) => {
      const restored = loadChatSession(site, sessionId);
      if (!restored.length) return;

      if (messages.length > 0) {
        archiveChatSession(site, messages);
      }

      deleteChatSession(site, sessionId);
      const nextSessions = readChatSessions(site);
      setMessages(restored);
      writeChatHistory(site, restored);
      setSessions(nextSessions);
      persistChat(restored, nextSessions);
      setError(null);
    },
    [messages, persistChat, site],
  );

  const removeSession = useCallback(
    (sessionId: string) => {
      deleteChatSession(site, sessionId);
      const nextSessions = readChatSessions(site);
      refreshSessions();
      persistChat(messages, nextSessions);
    },
    [messages, persistChat, refreshSessions, site],
  );

  return {
    messages,
    sessions,
    loading,
    error,
    send,
    clear,
    restoreSession,
    removeSession,
    refreshSessions,
    bottomRef,
    hasContext: Boolean(analysis || profile.description.trim()),
  };
}
