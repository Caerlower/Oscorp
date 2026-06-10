import { useWallet } from "@txnlab/use-wallet-react";
import { useSession } from "@/context/SessionContext";
import { useWalletClientReady } from "@/context/WalletReadyContext";
import { getAuthPhase, type AuthPhase } from "@/services/auth";

/** Single source of truth for sign-in state across the app. */
export function useAuth(): {
  phase: AuthPhase;
  userId: string | null;
  walletAddress: string | null;
  activeWalletAddress: string | null | undefined;
} {
  const clientReady = useWalletClientReady();
  const { isReady, activeAccount } = useWallet();
  const { userId, walletAddress, status, loading, sessionReady, web3authLink } = useSession();

  const phase = getAuthPhase({
    sessionReady,
    walletReady: clientReady && isReady,
    userId,
    walletAddress,
    status,
    loading,
    activeWalletAddress: activeAccount?.address,
    web3authLink,
  });

  return {
    phase,
    userId,
    walletAddress,
    activeWalletAddress: activeAccount?.address,
  };
}
