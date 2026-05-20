import { useCallback, useState } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { WalletId } from "@txnlab/use-wallet";
import { api } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { useWalletClientReady } from "@/context/WalletReadyContext";
import { hasWeb3AuthConfig } from "@/lib/wallet-config";
import { preloadWeb3AuthDeps } from "@/lib/preload-wallet-deps";
import { LAST_WALLET_KEY } from "@/lib/session-wallet";

const WALLET_ERRORS: Partial<Record<WalletId, string>> = {
  [WalletId.PERA]: "Pera Wallet not found. Install the Pera app or browser extension.",
  [WalletId.DEFLY]: "Defly Wallet not found. Install the Defly app.",
  [WalletId.LUTE]: "Lute Wallet not found. Install the Lute extension or app.",
  [WalletId.WEB3AUTH]:
    "Social login unavailable. Set VITE_WEB3AUTH_CLIENT_ID in frontend/.env and restart npm run dev.",
};

function addressFromConnectResult(
  accounts: { address: string }[],
  wallet: { activeAddress: string | null; addresses: string[] },
): string | null {
  const fromAccounts = accounts[0]?.address;
  if (fromAccounts) return fromAccounts;
  if (wallet.addresses[0]) return wallet.addresses[0];
  if (wallet.activeAddress) return wallet.activeAddress;
  return null;
}

export function useWalletConnect() {
  const clientReady = useWalletClientReady();
  const { wallets, activeAccount, activeWallet, isReady } = useWallet();
  const { setWalletSession, clearSession } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [web3AuthFlow, setWeb3AuthFlow] = useState(false);

  const connect = useCallback(
    async (walletId: WalletId) => {
      if (walletId === WalletId.WEB3AUTH && !hasWeb3AuthConfig()) {
        throw new Error(WALLET_ERRORS[WalletId.WEB3AUTH]!);
      }

      if (!clientReady || !isReady) {
        throw new Error("Wallets are still loading. Wait a moment and try again.");
      }

      setBusy(true);
      setError(null);
      if (walletId === WalletId.WEB3AUTH) {
        setWeb3AuthFlow(true);
      }
      try {
        const wallet = wallets?.find((w) => w.id === walletId);
        if (!wallet) {
          throw new Error(
            WALLET_ERRORS[walletId] ?? "Wallet provider not available in this browser.",
          );
        }

        if (walletId === WalletId.WEB3AUTH) {
          await preloadWeb3AuthDeps();
        }

        const accounts = await wallet.connect();
        wallet.setActive();

        let address = addressFromConnectResult(accounts, wallet);
        if (!address) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          address = addressFromConnectResult(accounts, wallet);
        }

        if (!address) {
          throw new Error("Wallet connected but no account address. Unlock your wallet and retry.");
        }

        const session = await api.connectWallet(address);
        setWalletSession(address, session.user_id);
        try {
          localStorage.setItem(LAST_WALLET_KEY, walletId);
        } catch {
          /* ignore */
        }
        return session;
      } catch (e) {
        let msg = e instanceof Error ? e.message : "Connection failed";
        if (msg === "Failed to fetch") {
          msg =
            "Cannot reach Oscorp API. Start the backend on port 8000 (see terminal).";
        }
        setError(msg);
        throw new Error(msg);
      } finally {
        setBusy(false);
        setWeb3AuthFlow(false);
      }
    },
    [wallets, clientReady, isReady, setWalletSession],
  );

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      if (activeWallet) {
        await activeWallet.disconnect();
      }
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

  return {
    wallets,
    activeAccount,
    busy,
    web3AuthFlow,
    error,
    connect,
    disconnect,
    clearError: () => setError(null),
    isReady,
  };
}
