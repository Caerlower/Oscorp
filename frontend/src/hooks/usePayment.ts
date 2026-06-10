import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import type { TransactionSignerApi } from "@/hooks/useTransactionSigner";
import {
  fundAgentWallet,
  getAgentWalletBalances,
  isAgentWalletFullSetup,
  isAgentWalletResumeSetup,
  planAgentWalletFunding,
  validateAgentAlgoTopUp,
  validateMainWalletForAgentFunding,
  type FundMainTxnKind,
  withdrawAgentWallet,
} from "@/utils/agent-wallet";
import { readLastWalletId } from "@/services/auth";
import { WalletId } from "@txnlab/use-wallet";
import { deriveAgentWalletFromSession } from "@/services/web3auth-connect";
import { fetchAccountBalances } from "@/utils/algorand-wallet";
import {
  buildUsdcTransferTx,
  checkPaymentReadiness,
  PaymentPreflightError,
} from "@/utils/algorand-wallet";
import { formatUsdc, type PaidAgent } from "@/constants/payment-constants";
import { usePaymentUser } from "@/hooks/usePaymentUser";
import type { FundPrompt } from "@/components/payment/FundWalletModal";
import { useX402Fetch, type X402FetchFn } from "@/hooks/useX402Fetch";

type PaymentSideEffects = {
  markAgentPaid?: (agent: PaidAgent) => void;
  unmarkAgentPaid?: (agent: PaidAgent) => void;
  refreshPaidAgents?: () => Promise<void>;
};

export function usePayment(signer: TransactionSignerApi, sideEffects: PaymentSideEffects = {}) {
  const { markAgentPaid, unmarkAgentPaid, refreshPaidAgents } = sideEffects;
  const { userId } = useSession();
  const { user, refresh, updateUser } = usePaymentUser();
  const { signAndSubmit: signAndSubmitTxn, signerAddress } = signer;
  const x402Fetch = useX402Fetch(signer);
  const [busy, setBusy] = useState(false);
  const [fundPrompt, setFundPrompt] = useState<FundPrompt | null>(null);
  const [agentWalletLow, setAgentWalletLow] = useState<{
    open: boolean;
    agent: PaidAgent;
    amount: number;
    shortfall: number;
  } | null>(null);

  const ensurePaymentReady = useCallback(
    async (amountUsdc: number) => {
      if (!signerAddress) {
        throw new Error("Wallet not connected");
      }
      const readiness = await checkPaymentReadiness(signerAddress, amountUsdc);
      if (!readiness.ok) {
        setFundPrompt({
          issue: readiness.issue,
          message: readiness.message,
          walletAddress: signerAddress,
        });
        throw new PaymentPreflightError(readiness.issue, readiness.message);
      }
    },
    [signerAddress],
  );

  const signAndSubmitUsdc = useCallback(
    async (
      amountUsdc: number,
      overrides?: { title?: string; message?: string },
    ): Promise<string> => {
      await ensurePaymentReady(amountUsdc);
      const txn = await buildUsdcTransferTx(signerAddress!, amountUsdc);
      return signAndSubmitTxn(txn, {
        title: overrides?.title ?? "Send USDC",
        message: overrides?.message ?? `Pay ${formatUsdc(amountUsdc)} from your wallet.`,
      });
    },
    [ensurePaymentReady, signAndSubmitTxn, signerAddress],
  );

  const signMainTxn = useCallback(
    async (txn: Awaited<ReturnType<typeof buildUsdcTransferTx>>, kind: FundMainTxnKind) => {
      if (kind === "algo") {
        return signAndSubmitTxn(txn, {
          title: "Send ALGO to agent wallet",
          message:
            "Send ~0.2 ALGO from your main wallet so the agent wallet can opt into and hold USDC.",
        });
      }
      return signAndSubmitTxn(txn, {
        title: "Send USDC to agent wallet",
        message: "Transfer USDC from your main wallet to your agent wallet.",
      });
    },
    [signAndSubmitTxn],
  );

  const refreshAgentBalanceCache = useCallback(
    async (agentAddress: string) => {
      const balances = await getAgentWalletBalances(agentAddress);
      await updateUser({
        agent_wallet_usdc_balance: balances.usdcMicro / 1_000_000,
      });
    },
    [updateUser],
  );

  const triggerPayment = useCallback(
    async <T>(agent: PaidAgent, run: (fetch: X402FetchFn) => Promise<T>): Promise<T> => {
      if (!userId) throw new Error("Session missing");
      if (!user) await refresh();
      if (!user) throw new Error("Payment profile unavailable");
      if (!x402Fetch) throw new Error("Wallet not connected");

      setBusy(true);
      try {
        const result = await run(x402Fetch);
        markAgentPaid?.(agent);
        void refreshPaidAgents?.({ silent: true });
        void refresh({ silent: true });
        return result;
      } catch (err) {
        unmarkAgentPaid?.(agent);
        const msg = err instanceof Error ? err.message : "Payment failed";
        if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("abort")) {
          toast.error("Payment cancelled");
        } else if (
          msg.toLowerCase().includes("parse payment requirements") ||
          msg.toLowerCase().includes("invalid payment required")
        ) {
          toast.error("Payment setup failed — refresh and try again");
        } else if (
          msg.toLowerCase().includes("create payment payload") ||
          msg.toLowerCase().includes("opt") ||
          msg.toLowerCase().includes("balance")
        ) {
          toast.error(`Payment failed — ${msg}`);
        } else if (msg.toLowerCase().includes("402") || msg.toLowerCase().includes("payment")) {
          toast.error(`Payment failed — ${msg}`);
        } else {
          toast.error(msg);
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [markAgentPaid, unmarkAgentPaid, refresh, refreshPaidAgents, user, userId, x402Fetch],
  );

  const topUpAgentWallet = useCallback(
    async (
      amountUsdc: number,
      options?: { algoTopUpMicro?: number },
    ) => {
      if (!user || !signerAddress) throw new Error("No payment user");
      setBusy(true);
      try {
        let agentAddressForPlan = user.agent_wallet_address ?? undefined;
        if (readLastWalletId() === WalletId.WEB3AUTH) {
          const derived = await deriveAgentWalletFromSession();
          agentAddressForPlan = derived.address;
        }

        const plan = await planAgentWalletFunding(
          signerAddress,
          amountUsdc,
          agentAddressForPlan,
        );
        const algoTopUpMicro = options?.algoTopUpMicro ?? plan.algoToSendMicro;

        const agentValidation = validateAgentAlgoTopUp(plan, algoTopUpMicro);
        if (!agentValidation.ok) {
          toast.error(agentValidation.message);
          throw new Error(agentValidation.message);
        }

        const mainBalances = await fetchAccountBalances(signerAddress);
        const validation = validateMainWalletForAgentFunding(
          mainBalances,
          plan,
          algoTopUpMicro,
        );
        if (!validation.ok) {
          toast.error(validation.message);
          throw new Error(validation.message);
        }

        const fullSetup = isAgentWalletFullSetup(plan);
        const resumeSetup = isAgentWalletResumeSetup(plan);
        const fundSignMainTxn =
          fullSetup || resumeSetup
            ? async (txn: Awaited<ReturnType<typeof buildUsdcTransferTx>>, kind: FundMainTxnKind) => {
                if (kind === "algo") {
                  return signAndSubmitTxn(txn, {
                    title: "Step 1 — Send ALGO to agent wallet",
                    message: `Send ~${(algoTopUpMicro / 1_000_000).toFixed(2)} ALGO so your agent wallet can opt into USDC (0.2 ALGO minimum on Algorand).`,
                  });
                }
                return signAndSubmitTxn(txn, {
                  title: resumeSetup ? "Send USDC to agent wallet" : "Step 3 — Send USDC to agent wallet",
                  message: `Transfer ${formatUsdc(amountUsdc)} USDC from your main wallet to your agent wallet.`,
                });
              }
            : signMainTxn;

        if (fullSetup && algoTopUpMicro > 0) {
          toast.message("Step 2 — USDC opt-in runs automatically (no approval needed)");
        } else if (resumeSetup) {
          toast.message("USDC opt-in runs automatically, then approve the USDC transfer.");
        }

        const result = await fundAgentWallet(signerAddress, amountUsdc, fundSignMainTxn, {
          algoTopUpMicro,
        });
        if (user.agent_wallet_address) {
          await refreshAgentBalanceCache(user.agent_wallet_address);
        }
        const algoPart =
          algoTopUpMicro > 0 ? ` and ${(algoTopUpMicro / 1_000_000).toFixed(3)} ALGO` : "";
        toast.success(
          fullSetup || resumeSetup
            ? `Agent wallet set up with ${formatUsdc(amountUsdc)} USDC${algoPart}`
            : `Funded agent wallet with ${formatUsdc(amountUsdc)} USDC${algoPart}`,
        );
        setAgentWalletLow(null);
        return result.usdcTxId;
      } catch (err) {
        if (err instanceof PaymentPreflightError) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : "";
        if (msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("cancel")) {
          toast.error("Payment cancelled");
        } else if (msg.includes("below min") || msg.includes("USDC opt-in")) {
          toast.error(msg);
        } else if (msg.includes("did not receive ALGO")) {
          toast.error("ALGO transfer not confirmed yet — wait a moment and try again.");
        } else {
          toast.error("Transaction failed, please try again");
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [refreshAgentBalanceCache, signAndSubmitTxn, signMainTxn, signerAddress, user],
  );

  const withdrawAgentFunds = useCallback(async () => {
    if (!user || !signerAddress) throw new Error("No payment user");
    setBusy(true);
    try {
      const txHash = await withdrawAgentWallet(signerAddress);
      await updateUser({ agent_wallet_usdc_balance: 0 });
      toast.success("Withdrawal successful");
      return txHash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "AGENT_WALLET_EMPTY") {
        toast.error("No USDC balance to withdraw");
      } else if (msg === "AGENT_WALLET_LOW_ALGO") {
        toast.error("Agent wallet needs ALGO for fees before withdrawal");
      } else {
        toast.error("Withdrawal failed");
      }
      throw err;
    } finally {
      setBusy(false);
    }
  }, [signerAddress, updateUser, user]);

  return {
    busy,
    fundPrompt,
    closeFundPrompt: () => setFundPrompt(null),
    agentWalletLow,
    closeAgentWalletLow: () => setAgentWalletLow(null),
    triggerPayment,
    topUpAgentWallet,
    withdrawAgentFunds,
    signAndSubmitUsdc,
    x402Fetch,
    user,
    refreshPaymentUser: refresh,
    updatePaymentUser: updateUser,
  };
}
