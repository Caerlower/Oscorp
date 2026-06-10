import { useCallback, useEffect, useMemo, useState } from "react";
import algosdk from "algosdk";
import { useWallet } from "@txnlab/use-wallet-react";
import { createX402Fetch } from "@oscorp/x402-payer";
import { API_URL } from "@/constants/config";
import { ALGOD_TOKEN, ALGOD_URL } from "@/constants/payment-constants";
import {
  deriveAgentWalletFromSession,
  getWeb3AuthSecretKey,
  type AgentWallet,
} from "@/services/web3auth-connect";
import type { TransactionSignerApi } from "@/hooks/useTransactionSigner";
import { usePaymentUser } from "@/hooks/usePaymentUser";
import { isAgentWalletMode } from "@/types/payment-user";
import {
  buildClientAvmSigner,
  rawEd25519SignerFromSecretKey,
  signAlgokitTxnBytes,
} from "@/utils/x402-signer";
import type { PaidAgent } from "@/constants/payment-constants";

export type X402FetchFn = (
  path: string,
  init?: RequestInit & { agent?: PaidAgent },
) => Promise<Response>;

type ApprovalRequest = {
  amount: string;
  description: string;
  resolve: (approved: boolean) => void;
};

let approvalBridge: ((request: ApprovalRequest) => void) | null = null;

/** Wired by PaymentProvider to show the per-action confirmation modal. */
export function registerX402ApprovalBridge(handler: (request: ApprovalRequest) => void) {
  approvalBridge = handler;
}

export function unregisterX402ApprovalBridge() {
  approvalBridge = null;
}

/** Reconstruct PAYMENT-REQUIRED when CORS hides it but the JSON body has requirements. */
async function x402AwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 402 || response.headers.get("PAYMENT-REQUIRED")) {
    return response;
  }

  const text = await response.text();
  let paymentRequired: unknown = null;
  try {
    const json = JSON.parse(text) as {
      detail?: { paymentRequired?: unknown };
      paymentRequired?: unknown;
    };
    paymentRequired = json.detail?.paymentRequired ?? json.paymentRequired;
  } catch {
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  if (!paymentRequired || typeof paymentRequired !== "object") {
    return new Response(text, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const headers = new Headers(response.headers);
  headers.set("PAYMENT-REQUIRED", btoa(JSON.stringify(paymentRequired)));
  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function requestPaymentApproval(amount: string, description: string): Promise<boolean> {
  if (!approvalBridge) return Promise.resolve(true);
  return new Promise((resolve) => {
    approvalBridge?.({ amount, description, resolve });
  });
}

export function useX402Fetch(transactionSigner: TransactionSignerApi): X402FetchFn | null {
  const { user } = usePaymentUser();
  const { signTransactions, isReady } = useWallet();
  const { signWithApproval, usesEmbeddedWallet, signerAddress } = transactionSigner;
  const [agentWallet, setAgentWallet] = useState<AgentWallet | null>(null);

  const agentMode = Boolean(user && isAgentWalletMode(user.payment_mode));

  useEffect(() => {
    let cancelled = false;
    if (agentMode) {
      void deriveAgentWalletFromSession()
        .then((wallet) => {
          if (!cancelled) setAgentWallet(wallet);
        })
        .catch(() => {
          if (!cancelled) setAgentWallet(null);
        });
    } else {
      setAgentWallet(null);
    }
    return () => {
      cancelled = true;
    };
  }, [agentMode, signerAddress]);

  const paymentAddress = agentMode ? (agentWallet?.address ?? null) : signerAddress;

  const signTxnBytes = useCallback(
    async (txnBytes: Uint8Array): Promise<Uint8Array> => {
      if (!paymentAddress) throw new Error("Wallet not connected");

      if (agentMode) {
        if (!agentWallet) throw new Error("Agent wallet not ready");
        return signAlgokitTxnBytes(
          txnBytes,
          await rawEd25519SignerFromSecretKey(agentWallet.secretKey),
        );
      }

      if (usesEmbeddedWallet) {
        const secretKey = await getWeb3AuthSecretKey();
        return signAlgokitTxnBytes(txnBytes, await rawEd25519SignerFromSecretKey(secretKey));
      }

      if (!isReady) throw new Error("Wallet not ready");

      const sdkTxn = algosdk.decodeUnsignedTransaction(txnBytes);
      if (signWithApproval) {
        return signWithApproval(sdkTxn, {
          title: "x402 payment",
          message: "Sign to authorize this micropayment on Algorand TestNet.",
        });
      }

      const signed = await signTransactions([[sdkTxn]], [0]);
      if (!signed?.[0]) throw new Error("Transaction cancelled");
      return signed[0];
    },
    [agentMode, agentWallet, isReady, paymentAddress, signTransactions, signWithApproval, usesEmbeddedWallet],
  );

  const x402Fetch = useMemo(() => {
    if (!paymentAddress) return null;

    const autoApprove = agentMode;
    const signer = buildClientAvmSigner(paymentAddress, signTxnBytes);
    const baseFetch = createX402Fetch(
      signer,
      {
        onPaymentRequired: autoApprove
          ? undefined
          : async (amount, description) => requestPaymentApproval(amount, description),
        algodUrl: ALGOD_URL,
        algodToken: ALGOD_TOKEN,
      },
      x402AwareFetch,
    );

    return async (path: string, init?: RequestInit & { agent?: PaidAgent }) => {
      const { agent, ...requestInit } = init ?? {};
      const headers = new Headers(requestInit.headers);
      headers.set("Content-Type", "application/json");
      if (user?.id) headers.set("X-User-Id", user.id);
      if (agent) headers.set("X-Oscorp-Agent", agent);

      const url = path.startsWith("http") ? path : `${API_URL}${path}`;
      return baseFetch(url, { ...requestInit, headers });
    };
  }, [agentMode, paymentAddress, signTxnBytes, user?.id]);

  return x402Fetch;
}
