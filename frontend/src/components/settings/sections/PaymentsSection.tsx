import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, QrCode, Wallet } from "lucide-react";
import { WalletQrModal } from "@/components/wallet/wallet-qr-modal";
import { toast } from "sonner";
import { usePaymentContext } from "@/context/PaymentContext";
import { useSession } from "@/context/SessionContext";
import { usePaymentUser } from "@/hooks/usePaymentUser";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { api } from "@/services/api";
import { deriveAgentWalletFromSession } from "@/services/web3auth-connect";
import { getAgentWalletBalances } from "@/utils/agent-wallet";
import {
  AgentWalletFundModal,
  type AgentWalletFundConfirm,
} from "@/components/payment/AgentWalletFundModal";
import { explorerTxUrl, formatUsdc, truncateAddress } from "@/constants/payment-constants";
import { isAgentWalletMode, normalizePaymentMode } from "@/types/payment-user";
import { readLastWalletId } from "@/services/auth";
import { WalletId } from "@txnlab/use-wallet";

export function PaymentsSection() {
  const { walletAddress } = useSession();
  const { disconnect } = useWalletConnect();
  const {
    user,
    busy,
    updatePaymentUser,
    topUpAgentWallet,
    withdrawAgentFunds,
    refreshPaymentUser,
  } = usePaymentContext();
  const { loading: profileLoading, ready: profileReady } = usePaymentUser();
  const [mainBalances, setMainBalances] = useState<{ algo: number; usdc: number } | null>(null);
  const [agentBalances, setAgentBalances] = useState<{ algo: number; usdc: number } | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [qrModal, setQrModal] = useState<{ address: string; title: string } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [lastWithdrawTx, setLastWithdrawTx] = useState<string | null>(null);

  const agentAddress = user?.agent_wallet_address ?? null;
  const usesSocialWallet = readLastWalletId() === WalletId.WEB3AUTH;
  const [fundingAgentAddress, setFundingAgentAddress] = useState<string | null>(agentAddress);

  useEffect(() => {
    if (!usesSocialWallet) {
      setFundingAgentAddress(agentAddress);
      return;
    }
    let cancelled = false;
    void deriveAgentWalletFromSession()
      .then((wallet) => {
        if (!cancelled) setFundingAgentAddress(wallet.address);
      })
      .catch(() => {
        if (!cancelled) setFundingAgentAddress(agentAddress);
      });
    return () => {
      cancelled = true;
    };
  }, [agentAddress, usesSocialWallet]);

  const loadBalances = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalances(true);
    try {
      const main = await api.getWalletBalances(walletAddress);
      setMainBalances({ algo: main.algo, usdc: main.usdc });
      const balanceAddress = fundingAgentAddress ?? agentAddress;
      if (balanceAddress) {
        const agent = await getAgentWalletBalances(balanceAddress);
        setAgentBalances({
          algo: agent.algoMicro / 1_000_000,
          usdc: agent.usdcMicro / 1_000_000,
        });
      } else {
        setAgentBalances(null);
      }
    } catch {
      setMainBalances(null);
      setAgentBalances(null);
    } finally {
      setLoadingBalances(false);
    }
  }, [walletAddress, agentAddress, fundingAgentAddress]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const toggleMode = async (mode: "per_action" | "agent_wallet") => {
    if (!user) return;
    if (mode === "agent_wallet" && !usesSocialWallet) {
      toast.error("Agent wallet mode requires signing in with Google or email.");
      return;
    }
    await updatePaymentUser({ payment_mode: mode });
    toast.success(
      mode === "agent_wallet" ? "Agent wallet payments enabled" : "Per-action payments enabled",
    );
  };

  const handleFundConfirm = async ({ usdcAmount, algoTopUpMicro }: AgentWalletFundConfirm) => {
    try {
      await topUpAgentWallet(usdcAmount, { algoTopUpMicro });
      setFundModalOpen(false);
      await loadBalances();
      await refreshPaymentUser();
    } catch {
      /* surfaced by hook */
    }
  };

  const handleWithdraw = async () => {
    if (!user) return;
    setWithdrawing(true);
    try {
      const txHash = await withdrawAgentFunds();
      setLastWithdrawTx(txHash);
      await refreshPaymentUser();
      await loadBalances();
    } catch {
      /* surfaced by hook */
    } finally {
      setWithdrawing(false);
    }
  };

  if (!walletAddress) {
    return <p className="text-sm text-muted-foreground">Sign in to manage payments.</p>;
  }

  const paymentMode = user ? normalizePaymentMode(user.payment_mode) : "per_action";
  const agentUsdc = agentBalances?.usdc ?? user?.agent_wallet_usdc_balance ?? 0;

  return (
    <div className="space-y-10">
      <header className="mc-settings-page-header">
        <h2 className="font-display text-2xl font-bold">Wallet & Payments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage main and agent wallets, balances, and payment mode.
        </p>
      </header>

      <section className="space-y-4">
        <div className="mc-wallet-card mc-wallet-card-main space-y-4 rounded-xl border border-border p-5 pl-6">
          <div>
            <p className="mc-section-label">Main Wallet</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{truncateAddress(walletAddress)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setQrModal({ address: walletAddress, title: "Main wallet address" })
                  }
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <QrCode className="h-3 w-3" /> QR
                </button>
                <button
                  type="button"
                  onClick={() => copy(walletAddress)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">ALGO</p>
                <p className="mt-1 font-medium">
                  {loadingBalances ? (
                    <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                  ) : mainBalances ? (
                    mainBalances.algo.toFixed(4)
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">USDC</p>
                <p className="mt-1 font-medium">
                  {loadingBalances ? (
                    <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                  ) : mainBalances ? (
                    formatUsdc(mainBalances.usdc)
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {(fundingAgentAddress ?? agentAddress) && (
          <div className="mc-wallet-card mc-wallet-card-agent space-y-4 rounded-xl border border-border p-5 pl-6">
            <div>
              <p className="mc-section-label">Agent Wallet</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="font-mono text-sm">
                  {truncateAddress(fundingAgentAddress ?? agentAddress!)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setQrModal({
                        address: fundingAgentAddress ?? agentAddress!,
                        title: "Agent wallet address",
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <QrCode className="h-3 w-3" /> QR
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(fundingAgentAddress ?? agentAddress!)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">ALGO</p>
                  <p className="mt-1 font-medium">
                    {loadingBalances ? (
                      <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                    ) : agentBalances ? (
                      agentBalances.algo.toFixed(4)
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-border p-3">
                  <p className="text-xs text-muted-foreground">USDC</p>
                  <p className="mt-1 font-medium">
                    {loadingBalances ? (
                      <Loader2 className="inline h-3.5 w-3.5 animate-spin" />
                    ) : (
                      formatUsdc(agentUsdc)
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setFundModalOpen(true)}
                  className="mc-btn-primary px-4 py-2 text-sm font-medium"
                >
                  Top Up
                </button>
                <button
                  type="button"
                  disabled={busy || withdrawing || agentUsdc <= 0}
                  onClick={() => void handleWithdraw()}
                  className="mc-btn-secondary px-4 py-2 text-sm font-medium"
                >
                  {withdrawing ? "Withdrawing…" : "Withdraw"}
                </button>
              </div>
              {lastWithdrawTx && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Withdrawal tx:{" "}
                  <button
                    type="button"
                    onClick={() => copy(lastWithdrawTx)}
                    className="font-mono hover:underline"
                  >
                    {truncateAddress(lastWithdrawTx)}
                  </button>
                  {explorerTxUrl(lastWithdrawTx) && (
                    <a
                      href={explorerTxUrl(lastWithdrawTx)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
                    >
                      View on Lora
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void disconnect()}
          className="text-sm text-red-600 hover:underline"
        >
          Disconnect wallet
        </button>
      </section>

      <section>
        <h3 className="font-display text-base font-bold">Payment mode</h3>
        {!profileReady || profileLoading || !user ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading payment profile…
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void toggleMode("per_action")}
              className={`rounded-xl border p-4 text-left transition ${
                paymentMode === "per_action"
                  ? "border-2 border-primary bg-primary/5"
                  : "border border-border hover:bg-muted/30"
              }`}
            >
              <p className="font-display text-sm font-semibold">Per-action approvals</p>
              <p className="mt-1 text-xs text-muted-foreground">Approve each agent payment individually.</p>
            </button>
            <button
              type="button"
              onClick={() => void toggleMode("agent_wallet")}
              disabled={!usesSocialWallet}
              className={`rounded-xl border p-4 text-left transition disabled:opacity-40 ${
                paymentMode === "agent_wallet"
                  ? "border-2 border-primary bg-primary/5"
                  : "border border-border hover:bg-muted/30"
              }`}
            >
              <p className="font-display text-sm font-semibold">Agent wallet</p>
              <p className="mt-1 text-xs text-muted-foreground">Pre-fund a dedicated agent wallet.</p>
            </button>
          </div>
        )}
        {profileReady && !profileLoading && user ? (
          <div className="mt-4 space-y-2">
            {!usesSocialWallet && (
              <p className="text-xs text-muted-foreground">
                Agent wallet mode is available when you sign in with Google or email (Web3Auth).
              </p>
            )}
            {isAgentWalletMode(paymentMode) && agentAddress && (
              <p className="text-sm text-muted-foreground">
                Agents pay automatically from your agent wallet ({formatUsdc(agentUsdc)} USDC
                available). Fund it above when balance runs low.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <WalletQrModal
        open={!!qrModal}
        address={qrModal?.address ?? null}
        title={qrModal?.title ?? "Wallet address"}
        onClose={() => setQrModal(null)}
      />

      {fundingAgentAddress && walletAddress && (
        <AgentWalletFundModal
          open={fundModalOpen}
          busy={busy}
          agentAddress={fundingAgentAddress}
          mainAddress={walletAddress}
          onConfirm={(params) => void handleFundConfirm(params)}
          onCancel={() => setFundModalOpen(false)}
        />
      )}
    </div>
  );
}
