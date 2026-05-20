import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { api, type AgentStatus } from "@/lib/api";

type Step = {
  id: string;
  label: string;
  done: boolean;
  to: string;
  cta: string;
};

export function SetupChecklist({
  status,
  hasDraft: hasDraftOverride,
}: {
  status: AgentStatus | null;
  /** Optional override; otherwise drafts are fetched for the current user. */
  hasDraft?: boolean;
}) {
  const { userId } = useSession();

  const { data: draftsData } = useQuery({
    queryKey: ["drafts", userId],
    queryFn: () => api.listDrafts(userId!),
    enabled: !!userId,
    staleTime: 60_000,
  });

  const hasDraft =
    hasDraftOverride ?? ((draftsData?.drafts?.length ?? 0) > 0);

  const steps: Step[] = [
    {
      id: "wallet",
      label: "Connect wallet",
      done: true,
      to: "/auth",
      cta: "Connect",
    },
    {
      id: "policy",
      label: "Sign growth policy",
      done: !!status?.policy_signed,
      to: "/onboarding",
      cta: "Set policy",
    },
    {
      id: "fund",
      label: "Fund agent wallet",
      done: !!status?.agent_funded,
      to: "/agent",
      cta: "Fund",
    },
    {
      id: "cycle",
      label: "Run first cycle",
      done: hasDraft,
      to: "/dashboard",
      cta: "Run",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="surface-card overflow-hidden ring-1 ring-amber-200/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-amber-50/60 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-amber-950">Finish setup</p>
          <p className="text-xs text-amber-900/70">
            {doneCount} of {steps.length} complete
          </p>
        </div>
        <div className="flex min-w-[120px] flex-1 items-center gap-2 sm:max-w-[200px]">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-medium text-amber-900">{pct}%</span>
        </div>
      </div>
      <ul className="divide-y divide-border/60">
        {steps.map((step) => (
          <li key={step.id}>
            <div className="flex items-center justify-between gap-3 px-5 py-3.5">
              <span className="flex items-center gap-3 text-sm">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-amber-300" />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : "font-medium"}>
                  {step.label}
                </span>
              </span>
              {!step.done && (
                <Link
                  to={step.to}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[oklch(0.28_0.03_270)] px-3 py-1.5 text-xs font-medium text-white"
                >
                  {step.cta}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
