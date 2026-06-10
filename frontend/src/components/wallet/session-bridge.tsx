import { useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useSession } from "@/context/SessionContext";
import { isWalletLinked } from "@/services/auth";

/**
 * After refresh, re-activate a native wallet that matches the saved session address.
 * Does not call the backend — connect only happens via explicit user action.
 */
export function WalletSessionBridge() {
  const { wallets, activeAccount, isReady } = useWallet();
  const { walletAddress, web3authLink } = useSession();

  useEffect(() => {
    if (!isReady || !walletAddress || isWalletLinked(walletAddress, activeAccount?.address, web3authLink)) {
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
  }, [wallets, activeAccount?.address, isReady, walletAddress, web3authLink]);

  return null;
}
