import { WalletId, type WalletManagerConfig } from "@txnlab/use-wallet";
import { NetworkId } from "@txnlab/use-wallet";

/** Read at call time so Vite env changes apply after dev server restart. */
export function getWeb3AuthClientId(): string {
  const raw = import.meta.env.VITE_WEB3AUTH_CLIENT_ID;
  return typeof raw === "string" ? raw.trim() : "";
}

export function hasWeb3AuthConfig(): boolean {
  return getWeb3AuthClientId().length > 10;
}

export function buildWalletManagerConfig(): WalletManagerConfig {
  // Google / email use services/web3auth-connect.ts (connectTo) — not use-wallet WEB3AUTH,
  // so we never open the duplicate Web3Auth modal on top of our login page.
  return {
    wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.LUTE],
    defaultNetwork: NetworkId.TESTNET,
  };
}
