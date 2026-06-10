import { WalletId } from "@txnlab/use-wallet";
import type { AgentStatus } from "@/services/api";

/** null = still checking embedded wallet; true/false = resolved */
export type Web3AuthLinkState = boolean | null;

export const SESSION_STORAGE_KEY = "oscorp_session";
export const LAST_WALLET_KEY = "oscorp_last_wallet";

export const PROTECTED_PATHS = ["/dashboard", "/profile", "/settings"] as const;

export type AuthPhase =
  | "booting"
  | "restoring"
  | "anonymous"
  | "needs_reconnect"
  | "authenticated";

type AuthInput = {
  sessionReady: boolean;
  walletReady: boolean;
  userId: string | null;
  walletAddress: string | null;
  status: AgentStatus | null;
  loading: boolean;
  activeWalletAddress: string | null | undefined;
  web3authLink: Web3AuthLinkState;
};

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function addressesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toUpperCase() === b.toUpperCase();
}

export function isWalletLinked(
  sessionWalletAddress: string | null,
  activeWalletAddress: string | null | undefined,
  web3authLink: Web3AuthLinkState,
): boolean {
  if (!sessionWalletAddress) return false;
  if (readLastWalletId() === WalletId.WEB3AUTH) {
    return web3authLink === true;
  }
  return addressesMatch(sessionWalletAddress, activeWalletAddress);
}

export function getAuthPhase(input: AuthInput): AuthPhase {
  const {
    sessionReady,
    walletReady,
    userId,
    walletAddress,
    status,
    loading,
    activeWalletAddress,
    web3authLink,
  } = input;

  if (!sessionReady || !walletReady) return "booting";
  if (!userId || !walletAddress) return "anonymous";
  if (loading) return "restoring";
  if (readLastWalletId() === WalletId.WEB3AUTH && web3authLink === null) return "restoring";
  if (!isWalletLinked(walletAddress, activeWalletAddress, web3authLink)) return "needs_reconnect";
  return "authenticated";
}

export function sessionHomePath(): "/dashboard" {
  return "/dashboard";
}

export function readLastWalletId(): WalletId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_WALLET_KEY);
    if (!raw) return null;
    if (Object.values(WalletId).includes(raw as WalletId)) {
      return raw as WalletId;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function prefersNativeWalletReconnect(): boolean {
  const last = readLastWalletId();
  return last === WalletId.PERA || last === WalletId.DEFLY || last === WalletId.LUTE;
}
