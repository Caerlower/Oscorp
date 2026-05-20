import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  ArrowUpRight,
  Clock,
  RefreshCw,
  RotateCcw,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PaymentReceipt } from "@/components/PaymentReceipt";
import { EmptyState } from "@/components/app/EmptyState";
import { useSession } from "@/context/SessionContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/drafts")({
  head: () => ({
    meta: [
      { title: "Drafts · Oscorp" },
      { name: "description", content: "AI-prepared drafts ready for your review." },
    ],
  }),
  component: Drafts,
});

const tints = ["bg-grad-lavender", "bg-grad-mint", "bg-grad-peach"];

function Drafts() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["drafts", userId],
    queryFn: () => api.listDrafts(userId!),
    enabled: !!userId,
  });

  const drafts = data?.drafts ?? [];

  const onRegenerate = async (draftId: string) => {
    if (!userId) return;
    setRegeneratingId(draftId);
    try {
      await api.regenerateDraft(userId, draftId);
      await queryClient.invalidateQueries({ queryKey: ["drafts", userId] });
      toast.success("New draft added (no extra x402 fee)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Queue"
        title="Drafts"
        subtitle="Review, regenerate, or post on X. Nothing publishes without you."
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {drafts.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="surface-card inline-flex items-center gap-2 px-4 py-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {drafts.length} draft{drafts.length === 1 ? "" : "s"}
          </span>
          <span className="text-xs text-muted-foreground">
            Regenerate tweaks copy without new x402 charges
          </span>
        </div>
      )}

      {!userId && (
        <p className="text-sm text-muted-foreground">
          <Link to="/auth" className="font-medium text-foreground underline">
            Connect wallet
          </Link>{" "}
          to see drafts.
        </p>
      )}

      {drafts.length === 0 && userId && (
        <EmptyState
          icon={Sparkles}
          title="No drafts yet"
          description="Fund your agent and run a growth cycle on Home or via Telegram /run."
          actionLabel="Go to agent"
          actionTo="/agent"
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {drafts.map((d, i) => (
          <motion.article
            key={d.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className={`surface-card group relative overflow-hidden transition hover:shadow-float ${
              i === 0 ? "ring-2 ring-primary/20" : ""
            }`}
          >
            {i === 0 && (
              <div className="border-b border-primary/10 bg-grad-lavender/30 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
                Latest
              </div>
            )}
            <div
              className={`absolute -right-16 -top-16 h-40 w-40 rounded-full ${tints[i % tints.length]} opacity-40 blur-3xl`}
            />
            <div className="relative p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium ring-1 ring-border">
                  <Sparkles className="h-3 w-3 text-primary" />
                  {d.category}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(d.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <p className="mt-4 text-base leading-relaxed">{d.content}</p>

              <div className="mt-4 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Why Oscorp picked this
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/75">{d.reasoning}</p>
              </div>

              <PaymentReceipt
                lines={d.payment_breakdown ?? []}
                receipt={d.payment_receipt}
              />

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-5">
                <a
                  href={d.intent_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
                >
                  Post on X
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  disabled={regeneratingId === d.id}
                  onClick={() => void onRegenerate(d.id)}
                  className="btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
                >
                  <RotateCcw
                    className={`h-3.5 w-3.5 ${regeneratingId === d.id ? "animate-spin" : ""}`}
                  />
                  {regeneratingId === d.id ? "Regenerating…" : "Regenerate"}
                </button>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </AppShell>
  );
}
