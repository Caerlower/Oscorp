/**
 * Optional wallet peer deps for @txnlab/use-wallet (dynamic import targets).
 * Web3Auth is heavy — only load when the user picks social login.
 */

let web3AuthPreload: Promise<void> | null = null;

/** Load Web3Auth no-modal stack (no login modal UI). */
export function preloadWeb3AuthDeps(): Promise<void> {
  if (!web3AuthPreload) {
    web3AuthPreload = Promise.all([
      import("@web3auth/no-modal"),
      import("@web3auth/auth-adapter"),
      import("@web3auth/base"),
      import("@web3auth/base-provider"),
    ]).then(() => undefined);
  }
  return web3AuthPreload;
}

/** Warm native wallet SDKs in the background (small; safe after first paint). */
export function preloadNativeWalletDeps(): void {
  if (typeof window === "undefined") return;
  void Promise.all([
    import("lute-connect"),
    import("@perawallet/connect"),
    import("@blockshake/defly-connect"),
  ]).catch(() => {
    /* use-wallet retries on connect */
  });
}
