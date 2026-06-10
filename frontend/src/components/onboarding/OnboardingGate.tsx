import { useCallback, useEffect, useState } from "react";
import { WalletId } from "@txnlab/use-wallet";
import { Bot, Copy, Layers, Loader2, MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import { WalletBrandIcon } from "@/components/wallet/brand-icon";
import { WalletAddressQr } from "@/components/wallet/wallet-address-qr";
import { WALLET_BRANDS } from "@/utils/wallet-logos";
import { readLastWalletId } from "@/services/auth";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { usePaymentUser } from "@/hooks/usePaymentUser";
import { useTransactionSignerContext } from "@/context/PaymentContext";
import { useSession } from "@/context/SessionContext";
import {
  buildUsdcOptInTx,
  fetchAccountBalances,
  hasMinimumAlgo,
} from "@/utils/algorand-wallet";
import {
  fundAgentWallet,
  getAgentWalletBalances,
  planAgentWalletFunding,
  validateMainWalletForAgentFunding,
  type AgentFundingPlan,
} from "@/utils/agent-wallet";
import {
  IS_ALGORAND_TESTNET,
  MIN_AGENT_ALGO_MICRO,
  formatUsdc,
  truncateAddress,
  usdcToMicro,
} from "@/constants/payment-constants";
import {
  clearPendingSite,
  isValidSite,
  normalizeSiteUrl,
  readPendingSite,
  storeSite,
} from "@/utils/navigation";
import type { PaymentMode } from "@/types/payment-user";
import { deriveAgentWalletFromSession } from "@/services/web3auth-connect";

type Step =
  | "wallet"
  | "algo"
  | "usdc"
  | "preference"
  | "main_usdc"
  | "agent_wallet"
  | "website"
  | "done";

const MIN_AGENT_FUND_USDC = 1;

function mainWalletHasFundingUsdc(balances: Awaited<ReturnType<typeof fetchAccountBalances>>): boolean {
  return balances.usdcOptedIn && balances.usdcMicro >= usdcToMicro(MIN_AGENT_FUND_USDC);
}

export function OnboardingGate({
  children,
  onSiteSaved,
}: {
  children: React.ReactNode;
  onSiteSaved?: (site: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <OnboardingGateInner onSiteSaved={onSiteSaved}>
      {children}
    </OnboardingGateInner>
  );
}

function OnboardingGateInner({
  children,
  onSiteSaved,
}: {
  children: React.ReactNode;
  onSiteSaved?: (site: string) => void;
}) {
  const { walletAddress } = useSession();
  const { user, loading, refresh, updateUser } = usePaymentUser();
  const { signAndSubmit: signAndSubmitTxn, signerAddress } = useTransactionSignerContext();
  const { connect, busy: walletBusy } = useWalletConnect();
  const usesSocialWallet = readLastWalletId() === WalletId.WEB3AUTH;
  const [step, setStep] = useState<Step>("wallet");
  const [checking, setChecking] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("per_action");
  const [agentAddress, setAgentAddress] = useState<string | null>(null);
  const [agentFunded, setAgentFunded] = useState(false);
  const [mainUsdcBalance, setMainUsdcBalance] = useState<number | null>(null);
  const [fundAmount, setFundAmount] = useState(MIN_AGENT_FUND_USDC);
  const [fundingPlan, setFundingPlan] = useState<AgentFundingPlan | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");

  const refreshFundingPlan = useCallback(
    async (address: string, amountUsdc: number) => {
      if (!signerAddress) return;
      const plan = await planAgentWalletFunding(signerAddress, amountUsdc, address);
      setFundingPlan(plan);
    },
    [signerAddress],
  );

  const advanceFromBalances = useCallback(async (address: string) => {
    setChecking(true);
    try {
      const balances = await fetchAccountBalances(address);
      if (!hasMinimumAlgo(balances)) {
        setStep("algo");
        return;
      }
      if (!balances.usdcOptedIn) {
        setStep("usdc");
        return;
      }
      setStep("preference");
    } finally {
      setChecking(false);
    }
  }, []);

  const profileSite =
    user?.product_site && isValidSite(user.product_site)
      ? normalizeSiteUrl(user.product_site)
      : null;

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    if (user.onboarding_completed) {
      // Don't skip ahead while user is still in an active onboarding step.
      if (["preference", "main_usdc", "agent_wallet", "website"].includes(step)) {
        return;
      }
      setStep(profileSite ? "done" : "website");
      return;
    }

    if (!walletAddress) {
      setStep("wallet");
    }
  }, [user, loading, walletAddress, profileSite, step]);

  useEffect(() => {
    if (step !== "website" || websiteUrl.trim()) return;
    const pending = readPendingSite();
    if (pending) setWebsiteUrl(pending);
  }, [step, websiteUrl]);

  // Only auto-route ALGO/USDC setup steps — never reset mid-onboarding after preference.
  useEffect(() => {
    if (loading || !user || user.onboarding_completed || !walletAddress) return;
    if (!["wallet", "algo", "usdc"].includes(step)) return;
    void advanceFromBalances(walletAddress);
  }, [walletAddress, loading, user, step, advanceFromBalances]);

  const pickWallet = async (id: WalletId) => {
    try {
      await connect(id);
      await refresh();
    } catch {
      /* surfaced by hook */
    }
  };

  const recheckAlgo = async () => {
    if (!walletAddress) return;
    await advanceFromBalances(walletAddress);
  };

  const enableUsdc = async () => {
    if (!signerAddress) {
      toast.error(usesSocialWallet ? "Sign in again to continue" : "Connect Pera or Defly wallet first");
      return;
    }
    setChecking(true);
    try {
      const txn = await buildUsdcOptInTx(signerAddress);
      await signAndSubmitTxn(txn);
      toast.success("USDC enabled");
      setStep("preference");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel")) {
        toast.error("Payment cancelled");
      } else {
        toast.error("Transaction failed, please try again");
      }
    } finally {
      setChecking(false);
    }
  };

  const loadAgentWalletStep = async () => {
    if (!usesSocialWallet || !signerAddress) {
      await finishOnboarding();
      return;
    }
    setChecking(true);
    try {
      const agent = await deriveAgentWalletFromSession();
      setAgentAddress(agent.address);
      try {
        await updateUser({ agent_wallet_address: agent.address });
      } catch (saveErr) {
        console.warn("Agent wallet address not persisted:", saveErr);
        toast.warning(
          "Agent wallet derived locally. Run the Supabase migration to persist it across sessions.",
        );
      }

      const mainBalances = await fetchAccountBalances(signerAddress);
      setMainUsdcBalance(mainBalances.usdcMicro / 1_000_000);

      if (!mainWalletHasFundingUsdc(mainBalances)) {
        setStep("main_usdc");
        return;
      }

      const balances = await getAgentWalletBalances(agent.address);
      if (
        balances.usdcMicro >= usdcToMicro(fundAmount) &&
        balances.algoMicro >= MIN_AGENT_ALGO_MICRO
      ) {
        setAgentFunded(true);
      }
      setStep("agent_wallet");
      await refreshFundingPlan(agent.address, fundAmount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("session expired") || msg.toLowerCase().includes("sign in")) {
        toast.error("Session expired — sign in again to set up your agent wallet.");
      } else {
        toast.error("Could not derive agent wallet. Sign in again and retry.");
      }
    } finally {
      setChecking(false);
    }
  };

  const recheckMainUsdc = async () => {
    if (!walletAddress) return;
    setChecking(true);
    try {
      const mainBalances = await fetchAccountBalances(walletAddress);
      setMainUsdcBalance(mainBalances.usdcMicro / 1_000_000);
      if (!mainWalletHasFundingUsdc(mainBalances)) {
        toast.error(`Add at least ${formatUsdc(MIN_AGENT_FUND_USDC)} USDC to your main wallet first.`);
        return;
      }
      if (!agentAddress) {
        await loadAgentWalletStep();
        return;
      }
      setStep("agent_wallet");
      toast.success("Main wallet funded — ready to fund your agent wallet");
    } finally {
      setChecking(false);
    }
  };

  const continueFromPreference = async () => {
    if (paymentMode === "agent_wallet" && usesSocialWallet) {
      await loadAgentWalletStep();
      return;
    }
    await finishOnboarding();
  };

  const fundAgentWalletOnboarding = async () => {
    if (!signerAddress || !agentAddress) return;
    if (fundAmount < MIN_AGENT_FUND_USDC) {
      toast.error(`Minimum fund amount is ${formatUsdc(MIN_AGENT_FUND_USDC)}`);
      return;
    }

    setChecking(true);
    try {
      const plan = await planAgentWalletFunding(signerAddress, fundAmount, agentAddress);
      setFundingPlan(plan);

      const mainBalances = await fetchAccountBalances(signerAddress);
      const validation = validateMainWalletForAgentFunding(
        mainBalances,
        plan,
        plan.algoToSendMicro,
      );
      if (!validation.ok) {
        if (validation.message.includes("USDC")) {
          setMainUsdcBalance(mainBalances.usdcMicro / 1_000_000);
          setStep("main_usdc");
        }
        toast.error(validation.message);
        return;
      }

      const signMainTxn = async (
        txn: Awaited<ReturnType<typeof buildUsdcOptInTx>>,
        kind: "algo" | "usdc",
      ) => {
        if (kind === "algo") {
          return signAndSubmitTxn(txn, {
            title: "Step 1 — Send ALGO to agent wallet",
            message: `Send ~${(plan.algoToSendMicro / 1_000_000).toFixed(2)} ALGO so your agent wallet can opt into USDC (0.2 ALGO minimum on Algorand).`,
          });
        }
        return signAndSubmitTxn(txn, {
          title: "Step 3 — Send USDC to agent wallet",
          message: `Transfer ${formatUsdc(fundAmount)} USDC from your main wallet to your agent wallet.`,
        });
      };

      if (plan.needsUsdcOptIn) {
        toast.message("Step 2 — USDC opt-in runs automatically (no approval needed)");
      }

      await fundAgentWallet(signerAddress, fundAmount, signMainTxn, {
        algoTopUpMicro: plan.algoToSendMicro,
      });
      const balances = await getAgentWalletBalances(agentAddress);
      await updateUser({
        agent_wallet_usdc_balance: balances.usdcMicro / 1_000_000,
      });
      setAgentFunded(true);
      await refreshFundingPlan(agentAddress, fundAmount);
      toast.success("Agent wallet funded with ALGO and USDC");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel")) {
        toast.error("Payment cancelled");
      } else {
        toast.error(msg || "Could not fund agent wallet");
      }
    } finally {
      setChecking(false);
    }
  };

  const finishOnboarding = async () => {
    if (!user) return;
    setChecking(true);
    try {
      await updateUser({
        payment_mode: paymentMode,
        onboarding_completed: true,
      });
      if (profileSite) {
        onSiteSaved?.(profileSite);
      }
      setStep(profileSite ? "done" : "website");
      toast.success(
        profileSite
          ? "Payments ready — opening your terminal…"
          : "Payments ready — add your website next",
      );
    } catch {
      toast.error("Could not complete setup");
    } finally {
      setChecking(false);
    }
  };

  const copyAddress = (addr: string) => {
    void navigator.clipboard.writeText(addr);
    toast.success("Address copied");
  };

  if (loading && !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (step === "done") {
    return <>{children}</>;
  }

  const saveWebsite = async () => {
    const raw = websiteUrl.trim();
    if (!isValidSite(raw)) {
      toast.error("Enter your product website (e.g. acme.com)");
      return;
    }
    if (!walletAddress) return;
    const normalized = normalizeSiteUrl(raw);
    storeSite(normalized, walletAddress);
    clearPendingSite();
    onSiteSaved?.(normalized);
    try {
      await updateUser({ product_site: normalized });
    } catch {
      toast.error("Could not save website to your profile — continuing with this URL locally.");
    }
    setStep("done");
    toast.success("Opening your terminal…");
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
        <div className="auth-card w-full max-w-lg p-8 text-center">
          <h2 className="text-xl font-semibold">Setting up payments</h2>
          <p className="mt-2 text-sm text-muted-foreground">Could not load your payment profile.</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="auth-btn-primary mt-6 w-full rounded-2xl px-4 py-3 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="auth-card w-full max-w-lg p-8">
        {step === "wallet" && usesSocialWallet && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {step === "wallet" && !usesSocialWallet && (
          <>
            <h2 className="text-xl font-semibold">Connect your wallet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose Pera or Defly to enable USDC payments on Algorand.
            </p>
            <div className="mt-6 space-y-2">
              {WALLET_BRANDS.filter((w) => w.id !== WalletId.LUTE).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  disabled={walletBusy}
                  onClick={() => void pickWallet(w.id)}
                  className="auth-wallet-pill flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left"
                >
                  <WalletBrandIcon walletId={w.id} size={32} />
                  {w.name}
                </button>
              ))}
            </div>
          </>
        )}

        {step === "algo" && walletAddress && (
          <>
            <h2 className="text-xl font-semibold">Fund your wallet first</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Send at least <span className="font-medium text-foreground">0.2 ALGO</span> to this
              address to cover transaction fees. Scan the QR code in Pera Wallet, or copy the address
              and send from an exchange.
            </p>
            <WalletAddressQr address={walletAddress} />
            {IS_ALGORAND_TESTNET && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Need testnet ALGO?{" "}
                <a
                  href="https://bank.testnet.algorand.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Get free ALGO from the dispenser
                </a>
                , then paste your address above.
              </p>
            )}
            <button
              type="button"
              disabled={checking}
              onClick={() => void recheckAlgo()}
              className="auth-btn-primary mt-6 w-full rounded-2xl px-4 py-3 text-sm font-medium"
            >
              {checking ? "Checking…" : "I've funded it"}
            </button>
          </>
        )}

        {step === "usdc" && (
          <>
            <h2 className="text-xl font-semibold">Enable USDC on your main wallet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              One-time opt-in so your main wallet can hold and send USDC (~0.001 ALGO fee). You&apos;ll
              add USDC balance in a later step if you choose agent wallet mode.
              {usesSocialWallet && " Approve the transaction here in Oscorp."}
            </p>
            <button
              type="button"
              disabled={checking}
              onClick={() => void enableUsdc()}
              className="auth-btn-primary mt-6 w-full rounded-2xl px-4 py-3 text-sm font-medium"
            >
              {checking ? "Preparing…" : "Enable USDC"}
            </button>
          </>
        )}

        {step === "main_usdc" && walletAddress && (
          <>
            <h2 className="text-xl font-semibold">Fund your main wallet with USDC</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Before funding your agent wallet, send at least{" "}
              <span className="font-medium text-foreground">{formatUsdc(MIN_AGENT_FUND_USDC)} USDC</span>{" "}
              to your main wallet. Keep ~0.5 ALGO on main too — it will send ~0.2 ALGO to the agent
              wallet (Algorand minimum to opt into and hold USDC).
            </p>
            <WalletAddressQr address={walletAddress} />
            {mainUsdcBalance !== null && (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                Current balance:{" "}
                <span className="font-medium text-foreground">{formatUsdc(mainUsdcBalance)} USDC</span>
              </p>
            )}
            {IS_ALGORAND_TESTNET && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                On testnet, swap ALGO for USDC in{" "}
                <a
                  href="https://app.tinyman.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  Tinyman
                </a>{" "}
                or send USDC from another wallet.
              </p>
            )}
            <button
              type="button"
              disabled={checking}
              onClick={() => void recheckMainUsdc()}
              className="auth-btn-primary mt-6 w-full rounded-2xl px-4 py-3 text-sm font-medium"
            >
              {checking ? "Checking…" : "I've added USDC"}
            </button>
          </>
        )}

        {step === "preference" && (
          <>
            <h2 className="text-xl font-semibold">How would you like to pay?</h2>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => setPaymentMode("per_action")}
                className={`rounded-2xl border p-4 text-left transition ${
                  paymentMode === "per_action" ? "border-primary bg-muted/40" : "border-border"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <MousePointerClick className="h-4 w-4" /> Pay per action
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Approve each payment individually. You stay in full control of every transaction.
                </p>
              </button>
              <button
                type="button"
                onClick={() => usesSocialWallet && setPaymentMode("agent_wallet")}
                disabled={!usesSocialWallet}
                className={`rounded-2xl border p-4 text-left transition ${
                  paymentMode === "agent_wallet" ? "border-primary bg-muted/40" : "border-border"
                } ${!usesSocialWallet ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Layers className="h-4 w-4" /> Agent wallet
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Fund a dedicated agent wallet once. Payments run automatically — no approvals per
                  action.
                </p>
                {!usesSocialWallet && (
                  <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                    Requires Google or email sign-in.
                  </p>
                )}
              </button>
            </div>
            <button
              type="button"
              disabled={checking}
              onClick={() => void continueFromPreference()}
              className="auth-btn-primary mt-6 w-full rounded-2xl px-4 py-3 text-sm font-medium"
            >
              {checking ? "Setting up…" : "Continue"}
            </button>
          </>
        )}

        {step === "agent_wallet" && agentAddress && (
          <>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Your Agent Wallet</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              A separate wallet derived from your login. Agents pay from here automatically — you
              won&apos;t approve each agent action.
            </p>
            <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Agent wallet is not set up yet</p>
              <p className="mt-2">
                It does <span className="font-medium text-foreground">not</span> hold USDC or opt in
                until you click Fund. Oscorp then:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>
                  You approve sending ~0.2 ALGO from main → agent (required Algorand
                  minimum to hold USDC)
                </li>
                <li>
                  Oscorp signs USDC opt-in for the agent wallet (silent — uses the derived key in
                  memory)
                </li>
                <li>You approve sending USDC from main → agent</li>
              </ol>
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Agent wallet address
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <code className="font-mono text-sm">{truncateAddress(agentAddress)}</code>
                <button
                  type="button"
                  onClick={() => copyAddress(agentAddress)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              {fundingPlan && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Status:{" "}
                  {fundingPlan.agentUsdcOptedIn ? "USDC enabled" : "USDC not enabled yet"} ·{" "}
                  {(fundingPlan.agentAlgoMicro / 1_000_000).toFixed(4)} ALGO
                </p>
              )}
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fund amount (USDC)
              </label>
              <input
                type="number"
                min={MIN_AGENT_FUND_USDC}
                step={0.5}
                value={fundAmount}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setFundAmount(next);
                  void refreshFundingPlan(agentAddress, next);
                }}
                className="field-input mt-2 w-full rounded-2xl"
              />
              <div className="mt-2 flex gap-2">
                {[1, 2, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setFundAmount(n);
                      void refreshFundingPlan(agentAddress, n);
                    }}
                    className="rounded-full border border-border px-3 py-1 text-xs"
                  >
                    ${n}
                  </button>
                ))}
              </div>
            </div>
            {fundingPlan && fundingPlan.algoToSendMicro > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Fund will also send ~{(fundingPlan.algoToSendMicro / 1_000_000).toFixed(2)} ALGO from
                your main wallet for agent fees.
              </p>
            )}
            {agentFunded ? (
              <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Agent wallet funded ✓
              </p>
            ) : (
              <button
                type="button"
                disabled={checking || fundAmount < MIN_AGENT_FUND_USDC}
                onClick={() => void fundAgentWalletOnboarding()}
                className="auth-btn-primary mt-4 w-full rounded-2xl px-4 py-3 text-sm font-medium"
              >
                {checking ? "Funding…" : `Fund Agent Wallet (${formatUsdc(fundAmount)} + ALGO)`}
              </button>
            )}
            <button
              type="button"
              disabled={checking || (paymentMode === "agent_wallet" && !agentFunded)}
              onClick={() => void finishOnboarding()}
              className="auth-btn-primary mt-3 w-full rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </>
        )}

        {step === "website" && (
          <>
            <h2 className="text-xl font-semibold">What&apos;s your product website?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ll analyze this site to build your company profile and marketing docs. Analysis
              only runs after you provide a real URL.
            </p>
            <div className="mt-5 space-y-2">
              <label
                htmlFor="onboarding-site"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Product URL
              </label>
              <input
                id="onboarding-site"
                type="text"
                autoComplete="url"
                placeholder="www.yourcompany.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && websiteUrl.trim()) saveWebsite();
                }}
                className="field-input w-full rounded-2xl"
              />
            </div>
            <button
              type="button"
              disabled={!websiteUrl.trim()}
              onClick={() => void saveWebsite()}
              className="auth-btn-primary mt-6 w-full rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              Open dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
