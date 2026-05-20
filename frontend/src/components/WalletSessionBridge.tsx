import { useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useSession } from "@/context/SessionContext";
import { isWalletExtensionConnected } from "@/lib/session-wallet";

/**
 * After refresh, wallet manager may resume Pera/Defly but not restore active account.
 * Re-activate the wallet that matches the persisted Oscorp session address.
 */
export function WalletSessionBridge() {
  const { wallets, activeAccount, isReady } = useWallet();
  const { walletAddress } = useSession();

  useEffect(() => {
    if (!isReady || !walletAddress || isWalletExtensionConnected(activeAccount?.address)) {
      return;
    }

    const normalized = walletAddress.toUpperCase();
    const match = wallets?.find(
      (w) =>
        w.isConnected &&
        w.accounts.some((a) => a.address.toUpperCase() === normalized),
    );
    if (match) {
      match.setActive();
      if (match.activeAccount?.address.toUpperCase() !== normalized) {
        match.setActiveAccount(walletAddress);
      }
    }
  }, [wallets, activeAccount?.address, isReady, walletAddress]);

  return null;
}
