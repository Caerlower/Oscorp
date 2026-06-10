import { useCallback, useRef, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { WalletId } from "@txnlab/use-wallet";
import { api, type SessionConnect } from "@/services/api";
import { useSession } from "@/context/SessionContext";
import { useWalletClientReady } from "@/context/WalletReadyContext";
import { addressesMatch, LAST_WALLET_KEY } from "@/services/auth";
import { clearLegacySiteStorage, clearStoredSite } from "@/utils/navigation";
import { hasWeb3AuthConfig } from "@/constants/wallet-config";
import {
  connectWeb3AuthDirect,
  deriveAgentWalletFromSession,
  getWeb3AuthAddressIfConnected,
  hasWeb3AuthRedirectParams,
  logoutWeb3AuthDirect,
  type Web3AuthConnectMethod,
} from "@/services/web3auth-connect";

const CONNECT_TIMEOUT_MS = 120_000;

const WALLET_ERRORS: Partial<Record<WalletId, string>> = {
  [WalletId.PERA]: "Pera Wallet not found. Install the Pera app or browser extension.",
  [WalletId.DEFLY]: "Defly Wallet not found. Install the Defly app.",
  [WalletId.LUTE]: "Lute Wallet not found. Install the Lute extension or app.",
};

function addressFromConnectResult(
  accounts: { address: string }[],
  wallet: unknown,
): string | null {
  const w = wallet as { activeAddress?: string | null; addresses?: string[] };
  return accounts[0]?.address ?? w.addresses?.[0] ?? w.activeAddress ?? null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function normalizeError(e: unknown): string {
  let msg = e instanceof Error ? e.message : "Connection failed";
  if (msg === "Failed to fetch") {
    msg = "Cannot reach Oscorp API. Start the backend on port 8000.";
  }
  const lower = msg.toLowerCase();
  if (
    lower.includes("user closed the modal") ||
    lower.includes("user closed") ||
    lower.includes("popup has been closed") ||
    lower.includes("login popup")
  ) {
    msg = "Sign-in was cancelled.";
  }
  return msg;
}

export function useWalletConnect() {
  const clientReady = useWalletClientReady();
  const { wallets, activeWallet, isReady } = useWallet();
  const { walletAddress, setWalletSession, refresh, clearSession } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectGen = useRef(0);

  const finishSession = useCallback(
    async (address: string, walletId: WalletId, gen: number): Promise<SessionConnect> => {
      if (walletAddress && !addressesMatch(walletAddress, address)) {
        clearStoredSite(walletAddress);
        clearSession();
      }
      clearLegacySiteStorage();

      const session = await api.connectWallet(address);
      if (gen !== connectGen.current) {
        throw new Error("Sign-in cancelled.");
      }

      // Agent/session APIs use the in-memory store id from /session/connect.
      // Payment profile lives in Supabase and may use a different id for the same wallet.
      setWalletSession(address, session.user_id);
      await refresh(session.user_id);

      if (walletId === WalletId.WEB3AUTH) {
        try {
          const paymentUser = await api.getPaymentUser(address);
          const agentWallet = await deriveAgentWalletFromSession();
          await api.updatePaymentUser(paymentUser.id, {
            agent_wallet_address: agentWallet.address,
          });
        } catch {
          /* agent wallet sync is best-effort; re-derived on each session */
        }
      }

      try {
        localStorage.setItem(LAST_WALLET_KEY, walletId);
      } catch {
        /* ignore */
      }
      return session;
    },
    [clearSession, refresh, setWalletSession, walletAddress],
  );

  const connectSocial = useCallback(
    async (method: Web3AuthConnectMethod, emailHint?: string): Promise<SessionConnect> => {
      if (!hasWeb3AuthConfig()) {
        throw new Error(
          "Social login unavailable. Set VITE_WEB3AUTH_CLIENT_ID in frontend/.env and restart the dev server.",
        );
      }
      if (!clientReady) {
        throw new Error("Still loading. Wait a moment and try again.");
      }

      const gen = ++connectGen.current;
      setBusy(true);
      setError(null);

      try {
        clearSession();
        await logoutWeb3AuthDirect();

        const address = await withTimeout(
          connectWeb3AuthDirect(method, emailHint, { forceFresh: true }),
          CONNECT_TIMEOUT_MS,
          "Sign-in timed out. Try again.",
        );
        if (gen !== connectGen.current) {
          throw new Error("Sign-in cancelled.");
        }
        return await finishSession(address, WalletId.WEB3AUTH, gen);
      } catch (e) {
        const msg = normalizeError(e);
        setError(msg);
        throw new Error(msg);
      } finally {
        if (gen === connectGen.current) setBusy(false);
      }
    },
    [clientReady, clearSession, finishSession],
  );

  const connect = useCallback(
    async (walletId: WalletId): Promise<SessionConnect> => {
      if (!clientReady || !isReady) {
        throw new Error("Wallets are still loading. Wait a moment and try again.");
      }

      const gen = ++connectGen.current;
      setBusy(true);
      setError(null);

      try {
        clearSession();
        await logoutWeb3AuthDirect();

        const wallet = wallets?.find((w) => w.id === walletId);
        if (!wallet) {
          throw new Error(
            WALLET_ERRORS[walletId] ?? "Wallet provider not available in this browser.",
          );
        }

        const accounts = await withTimeout(
          wallet.connect(),
          CONNECT_TIMEOUT_MS,
          "Connection timed out. Unlock your wallet and try again.",
        );
        if (gen !== connectGen.current) {
          throw new Error("Sign-in cancelled.");
        }

        wallet.setActive();

        let address = addressFromConnectResult(accounts, wallet);
        if (!address) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          address = addressFromConnectResult(accounts, wallet);
        }
        if (!address) {
          throw new Error("Wallet connected but no account address. Unlock your wallet and retry.");
        }

        return await finishSession(address, walletId, gen);
      } catch (e) {
        const msg = normalizeError(e);
        setError(msg);
        throw new Error(msg);
      } finally {
        if (gen === connectGen.current) setBusy(false);
      }
    },
    [wallets, clientReady, isReady, clearSession, finishSession],
  );

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await logoutWeb3AuthDirect();
      if (activeWallet) {
        await activeWallet.disconnect();
      }
      if (walletAddress) {
        clearStoredSite(walletAddress);
      }
      clearLegacySiteStorage();
      clearSession();
      try {
        localStorage.removeItem(LAST_WALLET_KEY);
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }, [activeWallet, clearSession]);

  /** Complete OAuth redirect only — never reuse a stale embedded-wallet session. */
  const resumeWeb3AuthRedirect = useCallback(async (): Promise<SessionConnect | null> => {
    if (!hasWeb3AuthConfig() || !clientReady) return null;
    if (!hasWeb3AuthRedirectParams()) return null;
    if (walletAddress) return null;

    const address = await getWeb3AuthAddressIfConnected();
    if (!address) return null;

    const gen = ++connectGen.current;
    setBusy(true);
    setError(null);
    try {
      return await finishSession(address, WalletId.WEB3AUTH, gen);
    } catch (e) {
      const msg = normalizeError(e);
      setError(msg);
      return null;
    } finally {
      if (gen === connectGen.current) setBusy(false);
    }
  }, [clientReady, finishSession, walletAddress]);

  return {
    busy,
    error,
    connect,
    connectSocial,
    resumeWeb3AuthRedirect,
    disconnect,
    clearError: () => setError(null),
    isReady: clientReady && isReady,
  };
}
