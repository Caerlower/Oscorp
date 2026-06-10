import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  agentHasEnoughAlgoForOptIn,
  isAgentWalletFullSetup,
  isAgentWalletResumeSetup,
  planAgentWalletFunding,
  type AgentFundingPlan,
} from "@/utils/agent-wallet";
import {
  formatUsdc,
  MIN_AGENT_ALGO_FOR_OPTIN_MICRO,
  MIN_AGENT_ALGO_MBR_MICRO,
  MIN_AGENT_ALGO_MICRO,
} from "@/constants/payment-constants";

export type AgentWalletFundConfirm = {
  usdcAmount: number;
  algoTopUpMicro: number;
};

export function AgentWalletFundModal({
  open,
  busy,
  agentAddress,
  mainAddress,
  defaultUsdc = 2,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  agentAddress: string;
  mainAddress: string;
  defaultUsdc?: number;
  onConfirm: (params: AgentWalletFundConfirm) => void;
  onCancel: () => void;
}) {
  const [usdcAmount, setUsdcAmount] = useState(defaultUsdc);
  const [algoAmount, setAlgoAmount] = useState(0);
  const [plan, setPlan] = useState<AgentFundingPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setUsdcAmount(defaultUsdc);
    }
    wasOpenRef.current = open;
  }, [open, defaultUsdc]);

  useEffect(() => {
    if (!open || !agentAddress || !mainAddress) return;

    let cancelled = false;
    setLoadingPlan(true);

    void planAgentWalletFunding(mainAddress, usdcAmount, agentAddress)
      .then((next) => {
        if (cancelled) return;
        setPlan(next);
        const suggestedAlgo = next.algoToSendMicro / 1_000_000;
        setAlgoAmount(suggestedAlgo > 0 ? Math.ceil(suggestedAlgo * 1000) / 1000 : 0);
      })
      .finally(() => {
        if (!cancelled) setLoadingPlan(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentAddress, mainAddress, open, usdcAmount]);

  if (!open) return null;

  const isFullSetup = plan ? isAgentWalletFullSetup(plan) : false;
  const isResumeSetup = plan ? isAgentWalletResumeSetup(plan) : false;
  const needsAlgo = (plan?.algoToSendMicro ?? 0) > 0;
  const needsOptIn = plan?.needsUsdcOptIn ?? false;
  const showOptionalAlgo =
    isResumeSetup &&
    plan !== null &&
    !agentHasEnoughAlgoForOptIn(plan.agentAlgoMicro);
  const algoTopUpMicro =
    needsAlgo || showOptionalAlgo ? Math.round(algoAmount * 1_000_000) : 0;
  const agentAlgo = plan ? plan.agentAlgoMicro / 1_000_000 : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px]"
      onClick={busy ? undefined : onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="pr-6">
            <p className="text-base font-semibold">
              {isFullSetup ? "Set up agent wallet" : isResumeSetup ? "Finish agent wallet setup" : "Fund agent wallet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isFullSetup
                ? "First-time setup: approve ALGO and USDC from your main wallet. USDC opt-in runs automatically."
                : isResumeSetup
                  ? "ALGO is already on your agent wallet. Approve the USDC transfer — opt-in runs automatically first."
                  : "Choose how much USDC to send. ALGO is only needed if your agent wallet is below the 0.2 ALGO minimum."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5">
          {isFullSetup && (
            <div className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Agent wallet is not set up yet</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  You approve sending ~{(MIN_AGENT_ALGO_MICRO / 1_000_000).toFixed(2)} ALGO from main →
                  agent (minimum to opt into and hold USDC)
                </li>
                <li>Oscorp signs USDC opt-in for the agent wallet (no popup)</li>
                <li>You approve sending USDC from main → agent</li>
              </ol>
            </div>
          )}

          {isResumeSetup && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-muted-foreground">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">ALGO funding complete</p>
              <p className="mt-1">
                Your agent wallet already has {(MIN_AGENT_ALGO_MBR_MICRO / 1_000_000).toFixed(1)} ALGO. Next:
                automatic USDC opt-in, then your USDC transfer.
              </p>
            </div>
          )}

          {plan && (
            <p className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Agent wallet: {agentAlgo.toFixed(4)} ALGO
              {plan.agentUsdcOptedIn ? " · USDC enabled" : " · USDC not enabled yet"}
            </p>
          )}

          <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              USDC amount
            </label>
            <input
              type="number"
              min={1}
              step={0.5}
              value={usdcAmount}
              onChange={(e) => setUsdcAmount(Number(e.target.value))}
              className="field-input mt-2 w-full rounded-xl text-sm"
            />
            <div className="mt-2 flex gap-2">
              {[1, 2, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setUsdcAmount(n)}
                  className={`rounded-full border px-3 py-1 text-xs hover:bg-muted ${
                    usdcAmount === n
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border"
                  }`}
                >
                  ${n}
                </button>
              ))}
            </div>
          </div>

          {(needsAlgo || showOptionalAlgo) && (
            <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {showOptionalAlgo && !needsAlgo
                  ? "ALGO top-up (optional)"
                  : "ALGO top-up (from main wallet)"}
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                {showOptionalAlgo && !needsAlgo
                  ? `Your agent wallet has ${(MIN_AGENT_ALGO_MBR_MICRO / 1_000_000).toFixed(1)} ALGO. Leave at 0 to finish with USDC only, or add ~${((MIN_AGENT_ALGO_FOR_OPTIN_MICRO - (plan?.agentAlgoMicro ?? 0)) / 1_000_000).toFixed(3)} ALGO if opt-in fails.`
                  : isFullSetup
                    ? `Send ~${(MIN_AGENT_ALGO_MICRO / 1_000_000).toFixed(2)} ALGO so the agent wallet can opt into USDC. Set to 0 only if it already has enough ALGO.`
                    : `Agent wallet is below ${(MIN_AGENT_ALGO_MBR_MICRO / 1_000_000).toFixed(1)} ALGO minimum. Set to 0 to skip if not needed.`}
              </p>
              <input
                type="number"
                min={0}
                step={0.001}
                value={algoAmount}
                onChange={(e) => setAlgoAmount(Math.max(0, Number(e.target.value)))}
                className="field-input mt-2 w-full rounded-xl text-sm"
              />
            </div>
          )}

          <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">You will approve:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {algoTopUpMicro > 0 && (
                <li>Send {(algoTopUpMicro / 1_000_000).toFixed(3)} ALGO → agent wallet</li>
              )}
              {needsOptIn && <li>USDC opt-in for agent wallet (automatic, no popup)</li>}
              <li>Send {formatUsdc(usdcAmount)} USDC → agent wallet</li>
            </ul>
            {algoTopUpMicro === 0 && !needsOptIn && (
              <p className="mt-1">Only the USDC transfer — no ALGO needed.</p>
            )}
            {algoTopUpMicro === 0 && needsOptIn && (
              <p className="mt-1">No ALGO transfer — only automatic opt-in, then USDC.</p>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 px-5 py-5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || loadingPlan || usdcAmount < 1}
            onClick={() =>
              onConfirm({
                usdcAmount,
                algoTopUpMicro,
              })
            }
            className="auth-btn-primary flex flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            {busy || loadingPlan ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : isFullSetup ? (
              `Fund agent wallet (${formatUsdc(usdcAmount)} + ALGO)`
            ) : isResumeSetup ? (
              `Finish setup (${formatUsdc(usdcAmount)} USDC)`
            ) : (
              "Confirm & fund"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
