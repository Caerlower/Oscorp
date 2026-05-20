import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  ArrowUpRight,
  FileText,
  MessageCircle,
  Wallet,
  Shield,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SetupChecklist } from "@/components/SetupChecklist";
import { MetricCard } from "@/components/app/MetricCard";
import { useSession } from "@/context/SessionContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PaymentReceipt } from "@/components/PaymentReceipt";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Home · Oscorp" }] }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { userId, status, refresh } = useSession();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: draftsData } = useQuery({
    queryKey: ["drafts", userId],
    queryFn: () => api.listDrafts(userId!),
    enabled: !!userId,
  });

  const drafts = draftsData?.drafts ?? [];
  const latest = drafts[0];
  const canRun = status?.policy_signed && status?.agent_funded;

  useEffect(() => {
    if (!userId) {
      navigate({ to: "/auth" });
      return;
    }
    if (status && !status.policy_signed) {
      navigate({ to: "/onboarding" });
    }
  }, [userId, status, navigate]);

  const runCycle = async () => {
    if (!userId) return;
    setRunning(true);
    try {
      await api.runCycle(userId);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["drafts", userId] });
      toast.success("Growth cycle complete — check Drafts");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cycle failed";
      toast.error(msg);
      if (msg.includes("funding") || msg.includes("402")) navigate({ to: "/agent" });
    } finally {
      setRunning(false);
    }
  };

  if (!userId) return null;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow={today}
        title="Home"
        subtitle="Run growth cycles, review drafts, and manage your agent — on web or Telegram."
        action={
          <button
            type="button"
            disabled={running || !canRun}
            onClick={() => void runCycle()}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm shadow-float disabled:opacity-50"
          >
            <Play className="h-4 w-4 shrink-0" />
            {running ? "Running…" : "Run cycle"}
          </button>
        }
      />

      <div className="mb-6">
        <SetupChecklist status={status} hasDraft={drafts.length > 0} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={FileText}
          tint="bg-grad-lavender"
          label="Drafts"
          value={String(drafts.length)}
          hint={drafts.length ? "In your queue" : "Run a cycle to create"}
          status={drafts.length > 0 ? "ok" : "neutral"}
        />
        <MetricCard
          icon={Wallet}
          tint="bg-grad-mint"
          label="Agent wallet"
          value={status?.agent_funded ? "Funded" : "Needs USDC"}
          hint="TestNet micropayments"
          status={status?.agent_funded ? "ok" : "warn"}
        />
        <MetricCard
          icon={Shield}
          tint="bg-grad-peach"
          label="Policy"
          value={status?.policy_signed ? "Signed" : "Pending"}
          status={status?.policy_signed ? "ok" : "warn"}
        />
        <MetricCard
          icon={Sparkles}
          tint="bg-grad-lavender"
          label="Telegram"
          value={status?.telegram_linked ? "Linked" : "Not linked"}
          hint="Use /run after linking"
          status={status?.telegram_linked ? "ok" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
            <div>
              <h2 className="font-semibold">Latest draft</h2>
              <p className="text-xs text-muted-foreground">Ready for your review</p>
            </div>
            {latest && (
              <span className="rounded-full bg-grad-mint/80 px-2.5 py-1 text-[11px] font-medium">
                {latest.category}
              </span>
            )}
          </div>

          <div className="p-6 md:p-8">
            {latest ? (
              <>
                <p className="text-lg font-medium leading-relaxed">{latest.content}</p>
                <div className="mt-4 rounded-2xl bg-muted/50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Why this angle
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
                    {latest.reasoning}
                  </p>
                </div>
                <PaymentReceipt
                  lines={latest.payment_breakdown ?? []}
                  receipt={latest.payment_receipt}
                />
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={latest.intent_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                  >
                    Post on X
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <Link
                    to="/drafts"
                    className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                  >
                    <FileText className="h-4 w-4" />
                    All drafts ({drafts.length})
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mt-4 font-medium">No drafts yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fund your agent, then run a cycle from here or Telegram.
                </p>
                <Link to="/agent" className="btn-primary mt-5 inline-flex px-5 py-2.5 text-sm">
                  Set up agent
                </Link>
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="surface-card p-5">
            <h3 className="text-sm font-semibold">Quick actions</h3>
            <ul className="mt-3 space-y-1">
              <QuickAction to="/agent" label="Fund agent wallet" />
              <QuickAction to="/drafts" label="Review all drafts" />
              <QuickAction to="/profile" label="Link Telegram" />
              <QuickAction to="/onboarding" label="Edit growth policy" />
            </ul>
          </div>

          <div className="surface-card overflow-hidden">
            <div className="flex items-start gap-3 bg-grad-lavender/40 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-soft">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Telegram copilot</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Link on Profile, then <code className="rounded bg-white/80 px-1 font-mono">/run</code>{" "}
                  for Post · Regenerate · Skip.
                </p>
                <Link
                  to="/profile"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
                >
                  Get User ID
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {!canRun && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950">
              {!status?.agent_funded
                ? "Fund your agent before running a cycle."
                : "Sign your policy in onboarding first."}
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function QuickAction({ to, label }: { to: string; label: string }) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
      >
        {label}
        <ChevronRight className="h-4 w-4 opacity-50" />
      </Link>
    </li>
  );
}
