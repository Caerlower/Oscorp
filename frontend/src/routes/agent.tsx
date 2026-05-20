import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Coins,
  Play,
  RefreshCw,
  Wallet,
  ExternalLink,
  CheckCircle2,
  Copy,
  Zap,
} from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { RequireSession } from "@/components/RequireSession";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useSession } from "@/context/SessionContext";
import { api, type FundInfo } from "@/lib/api";
import { microToUsd, normalizeAddress, submitAndWait, txnFromBase64 } from "@/lib/algorand";
import { toast } from "sonner";

export const Route = createFileRoute("/agent")({
  head: () => ({ meta: [{ title: "Agent · Oscorp" }] }),
  component: AgentPage,
});

function AgentPage() {
  return (
    <RequireSession>
      <AgentPageContent />
    </RequireSession>
  );
}

function AgentPageContent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, status, refresh, loading } = useSession();
  const { activeAccount, activeWallet, signTransactions } = useWallet();
  const { walletAddress } = useSession();
  const [fundInfo, setFundInfo] = useState<FundInfo | null>(null);
  const [fundInfoLoading, setFundInfoLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setFundInfoLoading(true);
    void api
      .fundInfo(userId)
      .then(setFundInfo)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setFundInfoLoading(false));
  }, [userId, status?.agent_funded, status?.usdc_micro]);

  const spendCapMicro =
    status?.min_fund_micro_usdc ?? fundInfo?.min_fund_micro_usdc ?? 500_000;
  const usdcMicro = status?.usdc_micro ?? fundInfo?.current_usdc_micro ?? 0;
  const minCycleMicro = 50_000;
  const cycleReady =
    status?.agent_funded ??
    fundInfo?.funded ??
    (!!(fundInfo?.usdc_opted_in ?? status?.usdc_opted_in) && usdcMicro >= minCycleMicro);
  /** Below policy spend cap — can top up toward cap (separate from “can run a cycle”). */
  const belowSpendCap = usdcMicro < spendCapMicro;
  const atSpendCap = !belowSpendCap;
  const topUpMicro = Math.max(spendCapMicro - usdcMicro, 0);
  const walletConnected = !!activeAccount?.address;
  const walletMismatch =
    walletConnected &&
    !!walletAddress &&
    normalizeAddress(activeAccount!.address) !== normalizeAddress(walletAddress);

  const agentAlgoMicro = fundInfo?.algo_micro ?? status?.algo_micro ?? 0;
  const agentOptedIn = fundInfo?.usdc_opted_in ?? status?.usdc_opted_in ?? false;
  const setupNote =
    fundInfo?.note ??
    (!cycleReady
      ? "Two steps: send ALGO to the agent, then USDC. Opt-in happens automatically."
      : null);

  const fundBlockReason = !walletConnected
    ? "Connect the same wallet you used at sign-in to approve the USDC transfer."
    : walletMismatch
      ? "Connected wallet does not match your session. Reconnect the wallet you signed in with."
      : fundInfoLoading
        ? "Loading fund details…"
        : null;

  const needsWalletForTransfer =
    belowSpendCap && (!walletConnected || walletMismatch) && !fundInfoLoading;

  /** Funding/top-up requires an active wallet session to sign txns in Pera/Defly/etc. */
  const canFund =
    walletConnected &&
    !walletMismatch &&
    !!status?.agent_address &&
    belowSpendCap &&
    !busy;

  const fundAgent = async () => {
    if (!userId) return;
    if (!activeAccount?.address || !activeWallet) {
      setError("Connect your wallet first (sidebar), then try again.");
      toast.error("Wallet not connected");
      return;
    }
    if (
      walletAddress &&
      normalizeAddress(activeAccount.address) !== normalizeAddress(walletAddress)
    ) {
      setError("Wrong wallet connected. Use the same address as when you signed in.");
      toast.error("Wallet mismatch");
      return;
    }
    setBusy("fund");
    setError(null);
    const addr = activeAccount.address;
    try {
      const step1 = await api.fundStep1Algo(userId, addr);
      if (!step1.skip && step1.transaction) {
        toast.message("Step 1/2: Approve ALGO to agent wallet");
        const signed = await signTransactions([txnFromBase64(step1.transaction)], [0]);
        const raw = signed.filter((b): b is Uint8Array => b != null);
        if (raw.length !== 1) throw new Error("ALGO payment was not signed.");
        const algoTxid = await submitAndWait(raw);
        setLastTx(algoTxid);
        toast.success("ALGO sent — opting agent into USDC…");
      }

      setBusy("fund-optin");
      await api.fundStep2AgentReady(userId);
      toast.success("Agent opted into USDC");

      setBusy("fund-usdc");
      const step3 = await api.fundStep3Usdc(userId, addr);
      toast.message(`Step 2/2: Approve USDC ($${microToUsd(step3.usdc_amount_micro)})`);
      const txnBytes = step3.transactions.map(txnFromBase64);
      const signedUsdc = await signTransactions(txnBytes, step3.indexes_to_sign);
      const rawUsdc = signedUsdc.filter((b): b is Uint8Array => b != null);
      if (rawUsdc.length !== signedUsdc.length) {
        throw new Error("USDC transfer was not signed.");
      }
      const usdcTxid = await submitAndWait(rawUsdc);
      setLastTx(usdcTxid);
      await refresh();
      setFundInfo(await api.fundInfo(userId));
      setError(null);
      toast.success("Agent funded with USDC");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Funding failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  };

  const startAgent = async () => {
    if (!userId) return;
    if (!cycleReady) {
      setError(
        `Agent needs at least $${(minCycleMicro / 1_000_000).toFixed(2)} USDC for provider payments.`,
      );
      return;
    }
    setBusy("run");
    setError(null);
    try {
      await api.runCycle(userId);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["drafts", userId] });
      toast.success("Cycle complete");
      navigate({ to: "/drafts" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Agent run failed");
    } finally {
      setBusy(null);
    }
  };

  if (!status?.policy_signed) {
    return (
      <AppShell>
        <PageHeader title="Sign your policy" subtitle="Complete onboarding before funding." />
        <Link to="/onboarding" className="btn-primary inline-flex items-center gap-2">
          Set growth policy
          <ArrowRight className="h-4 w-4" />
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="TestNet"
        title="Agent wallet"
        subtitle="Fund micropayments here. Run cycles on web or Telegram — drafts sync everywhere."
      />

      <div className="mb-6 surface-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-grad-mint">
            <Wallet className="h-6 w-6 text-foreground/60" />
          </div>
          <div>
            <p className="text-sm font-semibold">Agent status</p>
            <p className="text-xs text-muted-foreground">
              ${microToUsd(usdcMicro)} USDC · {(agentAlgoMicro / 1_000_000).toFixed(2)} ALGO
            </p>
          </div>
        </div>
        <StatusBadge
          ok={cycleReady}
          okLabel="Ready for cycles"
          warnLabel={cycleReady ? "Below spend cap" : "Needs funding"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-card p-6 md:p-8"
        >
          <h3 className="flex items-center gap-2 font-semibold">
            <Coins className="h-5 w-5 text-primary" />
            Fund agent
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Separate wallet for x402 provider calls. Cap set in your policy.
          </p>

          <div className="mt-5 rounded-2xl bg-muted/50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Address
            </p>
            <div className="mt-2 flex items-start gap-2">
              <p className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed">
                {status.agent_address}
              </p>
              <button
                type="button"
                className="btn-secondary shrink-0 px-2.5 py-1.5 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(status.agent_address);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <BalanceStat label="USDC balance" value={`$${microToUsd(status.usdc_micro)}`} />
            <BalanceStat
              label="Spend cap"
              value={`$${microToUsd(status.spend_cap_micro_usdc)}`}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatusBadge ok={agentOptedIn} okLabel="USDC opted in" warnLabel="Not opted in" />
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Min cycle ~$0.05
            </span>
          </div>

          {setupNote && (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
              {setupNote}
            </p>
          )}
          {needsWalletForTransfer && fundBlockReason && (
            <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Wallet required to top up</p>
              <p className="mt-1 text-xs leading-relaxed">{fundBlockReason}</p>
              <div className="mt-3">
                <ConnectWalletButton />
              </div>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {belowSpendCap && topUpMicro > 0 && walletConnected && !walletMismatch && (
            <p className="mt-4 text-xs text-muted-foreground">
              Next transfer: ~${microToUsd(topUpMicro)} USDC toward your $
              {microToUsd(spendCapMicro)} cap
            </p>
          )}

          <button
            type="button"
            disabled={!canFund && !busy}
            onClick={() => void fundAgent()}
            title={
              needsWalletForTransfer
                ? "Connect your wallet in the sidebar first"
                : atSpendCap
                  ? "Agent balance is at your spend cap"
                  : undefined
            }
            className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Coins className="h-4 w-4" />
            {busy === "fund" || busy === "fund-optin" || busy === "fund-usdc"
              ? busy === "fund-optin"
                ? "Opting into USDC…"
                : busy === "fund-usdc"
                  ? "Confirm USDC…"
                  : "Confirm ALGO…"
              : atSpendCap
                ? "At spend cap"
                : cycleReady
                  ? `Top up USDC (~$${microToUsd(topUpMicro)})`
                  : fundInfoLoading
                    ? "Loading…"
                    : "Fund agent (2 steps)"}
          </button>
          {lastTx && (
            <a
              href={`https://lora.algokit.io/testnet/transaction/${lastTx}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              View last tx
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="surface-card p-6 md:p-8"
        >
          <h3 className="flex items-center gap-2 font-semibold">
            <Zap className="h-5 w-5 text-primary" />
            Run growth cycle
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Trend + hook via x402, then Groq drafts a post for your queue.
          </p>

          <ul className="mt-6 space-y-3">
            {[
              { label: "Trend analyzer", cost: "~$0.01" },
              { label: "Hook generator", cost: "~$0.01" },
              { label: "AI draft", cost: "included" },
            ].map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3 text-sm"
              >
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {row.label}
                </span>
                <span className="text-xs text-muted-foreground">{row.cost}</span>
              </li>
            ))}
          </ul>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={!cycleReady || !!busy || loading}
            onClick={() => void startAgent()}
            className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {busy === "run" ? "Running cycle…" : "Run growth cycle"}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              void refresh().then(() =>
                userId ? api.fundInfo(userId).then(setFundInfo) : undefined,
              );
            }}
            className="btn-secondary mt-3 inline-flex w-full items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh status
          </button>
          <Link
            to="/drafts"
            className="mt-4 block text-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View drafts after running →
          </Link>
        </motion.div>
      </div>
    </AppShell>
  );
}

function BalanceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
