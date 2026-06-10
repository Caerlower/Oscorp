import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  AtSign,
  Bot,
  Loader2,
  MessageCircle,
  Minus,
  Paperclip,
  Plus,
  History,
  Trash2,
  X,
} from "lucide-react";
import { CmoChatContent } from "@/components/chat/CmoChatContent";
import { useTheme } from "@/context/ThemeContext";
import { useCmoChat } from "@/hooks/useCmoChat";
import { CHAT_CONTEXT_MENTIONS } from "@/utils/chat-context";
import { chatPlaceholder } from "@/constants/oscorp-theme";
import { cn } from "@/utils/utils";

const SUGGESTED_PROMPTS = [
  "What SEO issues should we fix first?",
  "Summarize our brand voice",
  "Draft a LinkedIn angle for this week",
] as const;

function CmoChatEmptyState({
  company,
  hasContext,
  loading,
  onSelect,
}: {
  company: string;
  hasContext: boolean;
  loading: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" aria-hidden />
          <span className="font-display text-sm font-bold text-foreground">AI CMO</span>
          <span className="oscorp-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground">
          Strategy, research, and content — grounded in your live site analysis.
        </p>
      </div>

      <div>
        <p className="mc-section-label mb-2">Context</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {hasContext ? (
            <>
              Ask about <span className="font-medium text-foreground">{company}</span>&apos;s SEO,
              company docs, competitors, or what to publish next. Use{" "}
              <span className="font-mono text-[11px] text-primary">@</span> to reference a specific
              doc.
            </>
          ) : (
            "Run a site analysis first — then I can answer using your product docs and SEO data."
          )}
        </p>
      </div>

      <div>
        <p className="mc-section-label mb-2">Suggested</p>
        <div className="flex flex-col gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelect(prompt)}
              disabled={loading}
              className="mc-btn-secondary h-auto w-full justify-start px-3 py-2.5 text-left text-xs font-medium leading-snug disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  drawerMode,
}: {
  role: "user" | "assistant";
  content: string;
  drawerMode?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex w-full min-w-0", isUser ? "justify-end" : "justify-start gap-2")}>
      {!isUser && drawerMode ? (
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      ) : null}
      <div
        className={cn(
          "min-w-0 max-w-[92%] break-words text-sm leading-relaxed [overflow-wrap:anywhere]",
          isUser
            ? drawerMode
              ? "whitespace-pre-wrap rounded-lg border border-border bg-muted/50 px-3 py-2 text-foreground"
              : "whitespace-pre-wrap rounded-2xl bg-foreground px-3.5 py-2.5 text-background"
            : drawerMode
              ? "min-w-0 flex-1 text-foreground"
              : "rounded-2xl border border-border/80 bg-muted/40 px-3.5 py-2.5 text-foreground",
        )}
      >
        {isUser ? content : <CmoChatContent content={content} accentDots={drawerMode} />}
      </div>
    </div>
  );
}

export function ChatPanel({
  company,
  site,
  onMinimize,
  drawerMode = false,
  onClose,
}: {
  company: string;
  site: string;
  onMinimize?: () => void;
  drawerMode?: boolean;
  onClose?: () => void;
}) {
  const { theme, isOscorp } = useTheme();
  const {
    messages,
    sessions,
    loading,
    error,
    send,
    clear,
    restoreSession,
    removeSession,
    bottomRef,
    hasContext,
  } = useCmoChat(company, site);
  const [input, setInput] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const mentionRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!mentionRef.current?.contains(target)) {
        setMentionOpen(false);
      }
      if (!historyRef.current?.contains(target)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const formatSessionDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const submit = () => {
    if (!input.trim() || loading) return;
    void send(input);
    setInput("");
    setMentionOpen(false);
  };

  const insertMention = (insert: string) => {
    setInput((prev) => `${prev}${insert}`);
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={`flex h-full min-h-0 w-full min-w-0 flex-col ${drawerMode ? "" : "gap-3"}`}>
      <div
        className={`flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${drawerMode ? "" : `rounded-2xl border bg-card ${isOscorp ? "oscorp-chat-shell" : "border-border"}`}`}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-between border-b border-border px-4 py-3",
            drawerMode && "bg-secondary",
          )}
        >
          <div className="flex items-center gap-2">
            {drawerMode ? (
              <>
                <span className="mc-section-label">AI CMO</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  //
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Online
                </span>
                <span className="oscorp-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="h-4 w-4" />
                Talk to AI CMO
                <span className="oscorp-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </div>
            )}
          </div>
          <div ref={historyRef} className="relative flex items-center gap-1 text-muted-foreground">
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              title="New chat"
              onClick={() => {
                setHistoryOpen(false);
                clear();
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={cn(
                "rounded p-1 hover:bg-muted",
                historyOpen && "bg-muted text-foreground",
              )}
              title="Chat history"
              onClick={() => setHistoryOpen((open) => !open)}
            >
              <History className="h-3.5 w-3.5" />
            </button>
            {drawerMode && onClose ? (
              <button type="button" title="Close" onClick={onClose} className="rounded p-1 hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : onMinimize ? (
              <button type="button" title="Minimize" onClick={onMinimize} className="rounded p-1 hover:bg-muted">
                <Minus className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {historyOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-border bg-popover p-1 shadow-lg">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Previous chats
                </p>
                {messages.length > 0 ? (
                  <div className="mb-1 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Current chat
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                      {messages.find((m) => m.role === "user")?.content.slice(0, 56) || "In progress"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {messages.length} message{messages.length === 1 ? "" : "s"}
                    </p>
                  </div>
                ) : null}
                {sessions.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-muted-foreground">
                    No archived chats yet. Start a conversation, then use + to save it here.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                    {sessions.map((session) => (
                      <li key={session.id}>
                        <div className="group flex items-start gap-1 rounded-lg px-1 py-0.5 hover:bg-muted/60">
                          <button
                            type="button"
                            onClick={() => {
                              restoreSession(session.id);
                              setHistoryOpen(false);
                            }}
                            className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left"
                          >
                            <p className="truncate text-xs font-medium text-foreground">{session.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatSessionDate(session.updatedAt)} · {session.messages.length} message
                              {session.messages.length === 1 ? "" : "s"}
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSession(session.id)}
                            className="mt-1.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
                            title="Delete chat"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4 text-sm",
            drawerMode && "bg-secondary",
          )}
        >
          {messages.length === 0 ? (
            <CmoChatEmptyState
              company={company}
              hasContext={hasContext}
              loading={loading}
              onSelect={(prompt) => void send(prompt)}
            />
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} role={msg.role} content={msg.content} drawerMode={drawerMode} />
            ))
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking…
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <div ref={bottomRef} />
        </div>

        <div
          className={cn(
            "sticky bottom-0 shrink-0 border-t border-border p-3",
            drawerMode ? "bg-secondary" : "bg-background",
          )}
        >
          <div className="flex items-end gap-2 rounded-lg border border-border bg-background px-2 py-1.5">
            <div ref={mentionRef} className="relative flex shrink-0 gap-0.5 text-muted-foreground">
              {drawerMode ? (
                <button type="button" className="rounded p-1.5 hover:bg-muted" title="Attach file">
                  <Paperclip className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setMentionOpen((o) => !o)}
                className={cn(
                  "rounded p-1.5 transition hover:bg-muted hover:text-foreground",
                  mentionOpen && "bg-muted text-foreground",
                )}
                title="Reference company context"
              >
                <AtSign className="h-4 w-4" />
              </button>
                {mentionOpen ? (
                  <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-border bg-popover p-1 shadow-lg">
                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Insert context
                    </p>
                    {CHAT_CONTEXT_MENTIONS.map((mention) => (
                      <button
                        key={mention.id}
                        type="button"
                        onClick={() => insertMention(mention.insert)}
                        className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                      >
                        <span className="text-xs font-medium">{mention.label}</span>
                        <span className="text-[10px] text-muted-foreground">{mention.description}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
            </div>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={chatPlaceholder(theme)}
              rows={1}
              disabled={loading}
              className="field-input min-h-[2.25rem] flex-1 resize-none border-0 bg-transparent py-1.5"
            />
            <button
              type="button"
              disabled={!input.trim() || loading}
              onClick={submit}
              className="mc-btn-primary flex h-8 w-8 shrink-0 items-center justify-center p-0 disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
