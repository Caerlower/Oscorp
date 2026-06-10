import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsLeft, ChevronsRight, Copy, Globe, Loader2, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { AGENT_COLORS } from "@/components/mission-control/agent-colors";
import { useAnalysis } from "@/context/AnalysisContext";
import { useCompanyProfile } from "@/context/CompanyProfileContext";
import { api } from "@/services/api";
import { buildCmoChatPayload } from "@/utils/chat-context";
import type { SeoIssue } from "@/types/analysis-types";

const fixCache = new Map<string, string>();

function buildFixPrompt(issueTitle: string, websiteUrl: string): string {
  return `Generate a detailed technical fix guide for this SEO issue: ${issueTitle}
for the website: ${websiteUrl}
Include: overview paragraph under ## Overview, numbered steps under ## Steps with code examples where relevant.
Return markdown only with ## Overview, ## Steps, numbered lists, and fenced code blocks.`;
}

export function SeoFixDetailModal({
  open,
  issue,
  company,
  site,
  onClose,
}: {
  open: boolean;
  issue: SeoIssue | null;
  company: string;
  site: string;
  onClose: () => void;
}) {
  const { data: analysis } = useAnalysis();
  const { profile } = useCompanyProfile();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = issue?.message ?? "";

  useEffect(() => {
    if (!open || !issue) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, issue, onClose]);

  useEffect(() => {
    if (!open || !issue) return;

    const cached = fixCache.get(cacheKey);
    if (cached) {
      setContent(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent("");

    const websiteUrl = site.startsWith("http") ? site : `https://${site}`;
    const prompt = buildFixPrompt(issue.message, websiteUrl);

    void api
      .cmoChat({
        message: prompt,
        history: [],
        ...buildCmoChatPayload(company, site, profile, analysis),
      })
      .then(({ reply }) => {
        if (cancelled) return;
        fixCache.set(cacheKey, reply);
        setContent(reply);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load fix guide");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, issue, cacheKey, company, site, profile, analysis]);

  const copyContent = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  if (!open || !issue) return null;

  return createPortal(
    <div className="mc-writer-modal-root fixed inset-0 z-[210] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[8px]"
        aria-label="Close SEO fix details"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="SEO fix recommendations"
        onClick={(e) => e.stopPropagation()}
        className="mc-writer-modal relative z-10 flex max-h-[min(92vh,800px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-secondary"
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: AGENT_COLORS.seo }}
            >
              <Globe className="h-3.5 w-3.5" />
            </div>
            <span className="truncate font-display text-sm font-bold">SEO & GEO Recommendations</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Previous"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled
              className="rounded-lg p-2 text-muted-foreground/40"
              aria-label="Next"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
          <p className="mc-section-label mb-4">Page: Homepage</p>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating fix guide…
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-background p-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => <h3 className="mc-section-label mb-3 mt-6 first:mt-0">{children}</h3>,
                  p: ({ children }) => (
                    <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">{children}</p>
                  ),
                  ol: ({ children }) => <ol className="mb-4 list-decimal space-y-7 pl-5">{children}</ol>,
                  li: ({ children }) => <li className="text-sm text-foreground">{children}</li>,
                  strong: ({ children }) => <span className="font-medium text-foreground">{children}</span>,
                  pre: ({ children }) => (
                    <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed">
                      {children}
                    </pre>
                  ),
                  code: ({ className, children }) => {
                    const isBlock = Boolean(className);
                    if (isBlock) return <code>{children}</code>;
                    return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>;
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!loading && !error && content ? (
          <div className="shrink-0 border-t border-border px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyContent()}
                className="mc-btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
