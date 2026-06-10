import { useCallback, useRef, useState } from "react";
import algosdk from "algosdk";
import { useWallet } from "@txnlab/use-wallet-react";
import { WalletId } from "@txnlab/use-wallet";
import { useSession } from "@/context/SessionContext";
import { readLastWalletId } from "@/services/auth";
import { submitSignedTx } from "@/utils/algorand-wallet";
import { describeAlgosdkTransaction, type TxnApprovalDetails } from "@/utils/txn-format";
import { signTransactionWithWeb3Auth } from "@/services/web3auth-connect";

type PendingApproval = {
  txn: algosdk.Transaction;
  approval: TxnApprovalDetails;
  mode: "submit" | "sign-only";
  resolveSubmit: (txId: string) => void;
  resolveSigned: (signed: Uint8Array) => void;
  reject: (err: unknown) => void;
};

export function useTransactionSigner() {
  const { walletAddress } = useSession();
  const { signTransactions, activeAccount, isReady } = useWallet();
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef<PendingApproval | null>(null);

  const usesEmbeddedWallet = readLastWalletId() === WalletId.WEB3AUTH;

  const signerAddress = usesEmbeddedWallet ? walletAddress : (activeAccount?.address ?? null);

  const signAndSubmit = useCallback(
    async (txn: algosdk.Transaction, overrides?: Partial<TxnApprovalDetails>): Promise<string> => {
      if (!signerAddress) {
        throw new Error("Wallet not connected");
      }

      if (!usesEmbeddedWallet && !isReady) {
        throw new Error("Wallet not ready");
      }

      const base = describeAlgosdkTransaction(txn);
      const approval: TxnApprovalDetails = {
        title: overrides?.title ?? base.title,
        message: overrides?.message ?? base.message,
        details: overrides?.details ?? base.details,
      };

      return new Promise<string>((resolve, reject) => {
        const entry: PendingApproval = {
          txn,
          approval,
          mode: "submit",
          resolveSubmit: resolve,
          resolveSigned: () => {},
          reject,
        };
        pendingRef.current = entry;
        setPending(entry);
      });
    },
    [isReady, signerAddress, usesEmbeddedWallet],
  );

  const signWithApproval = useCallback(
    async (txn: algosdk.Transaction, overrides?: Partial<TxnApprovalDetails>): Promise<Uint8Array> => {
      if (!signerAddress) {
        throw new Error("Wallet not connected");
      }

      if (!usesEmbeddedWallet && !isReady) {
        throw new Error("Wallet not ready");
      }

      const base = describeAlgosdkTransaction(txn);
      const approval: TxnApprovalDetails = {
        title: overrides?.title ?? base.title,
        message: overrides?.message ?? base.message,
        details: overrides?.details ?? base.details,
      };

      return new Promise<Uint8Array>((resolve, reject) => {
        const entry: PendingApproval = {
          txn,
          approval,
          mode: "sign-only",
          resolveSubmit: () => {},
          resolveSigned: resolve,
          reject,
        };
        pendingRef.current = entry;
        setPending(entry);
      });
    },
    [isReady, signerAddress, usesEmbeddedWallet],
  );

  const cancelApproval = useCallback(() => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.reject(new Error("Transaction cancelled"));
  }, []);

  const approvePending = useCallback(async () => {
    const current = pendingRef.current;
    if (!current) return;

    setBusy(true);
    try {
      let signed: Uint8Array;
      if (usesEmbeddedWallet) {
        signed = await signTransactionWithWeb3Auth(current.txn);
      } else {
        const result = await signTransactions([[current.txn]], [0]);
        if (!result?.[0]) {
          throw new Error("Transaction cancelled");
        }
        signed = result[0];
      }

      if (current.mode === "sign-only") {
        pendingRef.current = null;
        setPending(null);
        current.resolveSigned(signed);
        return;
      }

      const txId = await submitSignedTx(signed);
      pendingRef.current = null;
      setPending(null);
      current.resolveSubmit(txId);
    } catch (err) {
      pendingRef.current = null;
      setPending(null);
      current.reject(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [signTransactions, usesEmbeddedWallet]);

  return {
    signAndSubmit,
    signWithApproval,
    approvalOpen: pending !== null,
    approvalDetails: pending?.approval ?? null,
    approvalBusy: busy,
    approvePending,
    cancelApproval,
    usesEmbeddedWallet,
    signerAddress,
  };
}

export type TransactionSignerApi = ReturnType<typeof useTransactionSigner>;
