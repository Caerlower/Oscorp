import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  Pencil,
  RefreshCw,
  Save,
  Twitter,
  X,
  Zap,
} from "lucide-react";
import {
  detailCopyText,
  resolveDetailContent,
} from "@/components/dashboard/dashboard-detail-content";
import { useDashboardDetail } from "@/components/dashboard/detail-context";
import { agentAccentForDetailId } from "@/constants/detail-agent-theme";
import { downloadTextFile, slugifyFilename, type DocumentKey } from "@/utils/edited-documents";
import type { FullAnalysisResult } from "@/types/analysis-types";
import { usePaymentUser } from "@/context/PaymentUserContext";
import { api } from "@/services/api";
import { toast } from "sonner";
import { cn } from "@/utils/utils";

type DashboardDetailDrawerProps = {
  company: string;
  site: string;
  analysis: FullAnalysisResult | null;
  updateDocument: (key: DocumentKey, markdown: string) => void;
};

function WriterModalShell({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mc-writer-modal-root fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close detail panel"
        className="absolute inset-0 bg-black/40 backdrop-blur-[8px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="mc-writer-modal relative z-10 flex max-h-[min(92vh,800px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-secondary"
      >
        {children}
      </div>
    </div>
  );
}

function WriterModalHeader({
  title,
  accent,
  icon,
  onClose,
  markComplete,
}: {
  title: string;
  accent: string;
  icon: ReactNode;
  onClose: () => void;
  markComplete?: { marking: boolean; onClick: () => void };
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-2.5" id="dashboard-detail-title">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </div>
        <span className="truncate font-display text-sm font-bold">{title}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {markComplete ? (
          <button
            type="button"
            disabled={markComplete.marking}
            onClick={markComplete.onClick}
            className={`mc-btn-secondary h-8 px-3 text-xs font-medium ${
              markComplete.marking ? "mc-btn-primary border-transparent" : "border-primary text-primary"
            }`}
          >
            <Check className="mr-1 inline h-3.5 w-3.5" />
            {markComplete.marking ? "Saving…" : "Mark Complete"}
          </button>
        ) : null}
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
  );
}

function WriterActionButton({
  children,
  onClick,
  variant = "secondary",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        variant === "primary"
          ? "mc-btn-primary inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium"
          : "mc-btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium"
      }
    >
      {children}
    </button>
  );
}

function WriterModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-border px-6 py-4">
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function WriterContentPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-background", className)}>
      {children}
    </div>
  );
}

function WriterAuthorRow({ company }: { company: string }) {
  const initial = company.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="mc-company-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold text-white">
        {initial}
      </div>
      <div className="min-w-0">
        <p className="mc-section-label">Draft for</p>
        <p className="truncate font-display text-sm font-bold text-foreground">{company}</p>
      </div>
    </div>
  );
}

function WriterWhyWorksSection({ children }: { children: ReactNode }) {
  return (
    <div className="mc-why-works mx-6 mb-6 shrink-0 px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">
          Why this works
        </span>
      </div>
      {children}
    </div>
  );
}

export function DashboardDetailDrawer({
  company,
  site,
  analysis,
  updateDocument,
}: DashboardDetailDrawerProps) {
  const { detailId, params, closeDetail } = useDashboardDetail();

  useEffect(() => {
    if (!detailId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId, closeDetail]);

  useEffect(() => {
    if (!detailId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [detailId]);

  if (!detailId || typeof document === "undefined") return null;

  const content = resolveDetailContent(detailId, params, { company, site }, analysis);
  if (!content) return null;

  const isWriter = content.layout === "writer";
  const isEditableDocument = Boolean(content.editableDocKey);
  const accent = agentAccentForDetailId(detailId);

  return createPortal(
    <WriterModalShell onClose={closeDetail}>
      {isWriter ? (
        <WriterDetailView content={content} company={company} accent={accent} onClose={closeDetail} />
      ) : isEditableDocument ? (
        <DocumentDetailView content={content} accent={accent} onClose={closeDetail} updateDocument={updateDocument} />
      ) : (
        <DefaultDetailView content={content} accent={accent} onClose={closeDetail} />
      )}
    </WriterModalShell>,
    document.body,
  );
}

function DocumentDetailView({
  content,
  accent,
  onClose,
  updateDocument,
}: {
  content: NonNullable<ReturnType<typeof resolveDetailContent>>;
  accent: string;
  onClose: () => void;
  updateDocument: (key: DocumentKey, markdown: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content.markdown ?? "");
  const [savedMarkdown, setSavedMarkdown] = useState(content.markdown ?? "");
  const Icon = content.icon;
  const docKey = content.editableDocKey!;

  useEffect(() => {
    setDraft(content.markdown ?? "");
    setSavedMarkdown(content.markdown ?? "");
    setEditing(false);
  }, [content.markdown, content.title]);

  const copyAll = async () => {
    const text = detailCopyText({ ...content, markdown: editing ? draft : savedMarkdown });
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const downloadDoc = () => {
    const text = detailCopyText({ ...content, markdown: editing ? draft : savedMarkdown });
    downloadTextFile(slugifyFilename(content.title), text);
    toast.success("Download started");
  };

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Document cannot be empty");
      return;
    }
    updateDocument(docKey, trimmed);
    setSavedMarkdown(trimmed);
    setEditing(false);
    toast.success("Document saved");
  };

  return (
    <>
      <WriterModalHeader
        title={content.title}
        accent={accent}
        icon={<Icon className="h-3.5 w-3.5" />}
        onClose={onClose}
      />

      {editing && (
        <div className="mc-alert mc-alert-warning shrink-0 text-[13px]">
          Editing — Markdown supported. Use ## for headings.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        {content.pageTag && !editing && <p className="mc-section-label mb-4">{content.pageTag}</p>}

        <WriterContentPanel>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mc-writer-draft block min-h-[min(60vh,480px)] w-full resize-y border-0 bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
              spellCheck
            />
          ) : (
            <div className="p-4">
              <MarkdownContent>{savedMarkdown}</MarkdownContent>
            </div>
          )}
        </WriterContentPanel>
      </div>

      <WriterModalFooter>
        {editing ? (
          <>
            <WriterActionButton onClick={() => setEditing(false)}>Cancel</WriterActionButton>
            <WriterActionButton variant="primary" onClick={save}>
              <Save className="h-3.5 w-3.5" /> Save
            </WriterActionButton>
          </>
        ) : (
          <>
            <WriterActionButton onClick={() => void copyAll()}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </WriterActionButton>
            <WriterActionButton onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </WriterActionButton>
            <WriterActionButton onClick={downloadDoc}>
              <Download className="h-3.5 w-3.5" /> Download
            </WriterActionButton>
          </>
        )}
      </WriterModalFooter>
    </>
  );
}

function DefaultDetailView({
  content,
  accent,
  onClose,
}: {
  content: NonNullable<ReturnType<typeof resolveDetailContent>>;
  accent: string;
  onClose: () => void;
}) {
  const Icon = content.icon;

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(detailCopyText(content));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <>
      <WriterModalHeader
        title={content.title}
        accent={accent}
        icon={<Icon className="h-3.5 w-3.5" />}
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
        {content.pageTag && <p className="mc-section-label mb-4">{content.pageTag}</p>}

        {content.markdown ? (
          <WriterContentPanel>
            <div className="p-4">
              <MarkdownContent>{content.markdown ?? ""}</MarkdownContent>
            </div>
          </WriterContentPanel>
        ) : null}

        {content.overview && !content.markdown && (
          <section className="mb-6">
            <h3 className="mc-section-label mb-3">Overview</h3>
            <WriterContentPanel>
              <div className="p-4">
                <MarkdownContent variant="compact" className="text-[13px] text-muted-foreground">
                  {content.overview}
                </MarkdownContent>
              </div>
            </WriterContentPanel>
          </section>
        )}

        {content.steps && content.steps.length > 0 && !content.markdown && (
          <section>
            <h3 className="mc-section-label mb-4">Steps</h3>
            <ol className="space-y-4">
              {content.steps.map((step, index) => (
                <li key={step.title}>
                  <WriterContentPanel>
                    <div className="p-4 text-sm">
                      <div className="mb-2 font-display text-sm font-bold text-foreground">
                        {index + 1}. {step.title}
                      </div>
                      {step.description && (
                        <MarkdownContent variant="compact" className="mb-3 text-[13px] text-muted-foreground">
                          {step.description}
                        </MarkdownContent>
                      )}
                      {step.codeBefore && step.codeAfter && (
                        <div className="grid gap-3 lg:grid-cols-2">
                          <CodeBlock label="Before" code={step.codeBefore} />
                          <CodeBlock label="After" code={step.codeAfter} />
                        </div>
                      )}
                      {step.code && !step.codeBefore && <CodeBlock code={step.code} />}
                    </div>
                  </WriterContentPanel>
                </li>
              ))}
            </ol>
          </section>
        )}

        {content.extra && <div className="mt-6">{content.extra}</div>}
      </div>

      <WriterModalFooter>
        <WriterActionButton onClick={() => void copyAll()}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </WriterActionButton>
      </WriterModalFooter>
    </>
  );
}

function WriterDetailView({
  content,
  company,
  accent,
  onClose,
}: {
  content: NonNullable<ReturnType<typeof resolveDetailContent>>;
  company: string;
  accent: string;
  onClose: () => void;
}) {
  const { params } = useDashboardDetail();
  const { user: paymentUser } = usePaymentUser();
  const [draft, setDraft] = useState(content.draftText ?? "");
  const [marking, setMarking] = useState(false);
  const intentUrl = params.intentUrl?.trim();
  const deliverableId = params.deliverableId?.trim();
  const Icon = content.icon;
  const canIntentPost = Boolean(intentUrl);

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy");
    }
  };

  const post = () => {
    if (!intentUrl) return;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
  };

  const downloadDraft = () => {
    downloadTextFile(slugifyFilename(content.title), draft);
    toast.success("Download started");
  };

  return (
    <>
      <WriterModalHeader
        title={content.title}
        accent={accent}
        icon={<Icon className="h-3.5 w-3.5" />}
        onClose={onClose}
        markComplete={
          content.showMarkComplete
            ? {
                marking,
                onClick: () => {
                  void (async () => {
                    setMarking(true);
                    try {
                      if (deliverableId && paymentUser?.id) {
                        await api.markDeliverablePosted(deliverableId, paymentUser.id);
                        const agent = params.agent?.trim();
                        window.dispatchEvent(
                          new CustomEvent("oscorp:deliverable-posted", {
                            detail: {
                              id: deliverableId,
                              agent:
                                agent === "articles" ||
                                agent === "hackernews" ||
                                agent === "linkedin"
                                  ? agent
                                  : undefined,
                            },
                          }),
                        );
                      }
                      toast.success("Marked complete — ready for your next draft");
                      onClose();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not mark complete");
                    } finally {
                      setMarking(false);
                    }
                  })();
                },
              }
            : undefined
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
          <WriterAuthorRow company={company} />

          <WriterContentPanel>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mc-writer-draft block min-h-[280px] w-full resize-y whitespace-pre-line border-0 bg-transparent p-4 text-base leading-[1.7] text-foreground outline-none focus:ring-0"
            />
          </WriterContentPanel>
        </div>

        <WriterModalFooter>
          {canIntentPost ? (
            <WriterActionButton variant="primary" onClick={post}>
              <Twitter className="h-3.5 w-3.5" /> Post
            </WriterActionButton>
          ) : null}
          <WriterActionButton
            variant={canIntentPost ? "secondary" : "primary"}
            onClick={() => void copyDraft()}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </WriterActionButton>
          <WriterActionButton
            onClick={() => toast.message("Rewrite", { description: "Queued for AI CMO rewrite." })}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Rewrite
          </WriterActionButton>
          <WriterActionButton onClick={downloadDraft}>
            <Download className="h-3.5 w-3.5" /> Download
          </WriterActionButton>
        </WriterModalFooter>

        {content.whyThisWorks && (
          <WriterWhyWorksSection>
            <MarkdownContent variant="compact" className="text-[13px] leading-relaxed text-muted-foreground">
              {content.whyThisWorks}
            </MarkdownContent>
          </WriterWhyWorksSection>
        )}
      </div>
    </>
  );
}

function CodeBlock({ label, code }: { label?: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      {label && (
        <div className="border-b border-border px-3 py-2 font-display text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </div>
      )}
      <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-foreground">{code}</pre>
    </div>
  );
}
