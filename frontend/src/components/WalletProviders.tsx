import { type ReactNode, useEffect, useState } from "react";
import { NetworkId, WalletManager } from "@txnlab/use-wallet";
import { WalletProvider } from "@txnlab/use-wallet-react";
import { buildWalletManagerConfig } from "@/lib/wallet-config";
import { SessionProvider, SessionWalletSync } from "@/context/SessionContext";
import { WalletReadyProvider } from "@/context/WalletReadyContext";
import { WalletSessionBridge } from "@/components/WalletSessionBridge";
import { preloadNativeWalletDeps } from "@/lib/preload-wallet-deps";

function ssrManager() {
  return new WalletManager({ wallets: [], defaultNetwork: NetworkId.TESTNET });
}

/**
 * SSR uses a stub manager only (no buffer/process polyfills — those break SSR).
 * Client loads polyfills in useEffect, then swaps to the full WalletManager.
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState<WalletManager>(ssrManager);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void import("@/lib/polyfills").then(() => {
      if (cancelled) return;
      setManager(new WalletManager(buildWalletManagerConfig()));
      setClientReady(true);
      preloadNativeWalletDeps();
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WalletReadyProvider ready={clientReady}>
      <WalletProvider key={clientReady ? "client" : "ssr"} manager={manager}>
        <SessionProvider>
          {clientReady && (
            <>
              <SessionWalletSync />
              <WalletSessionBridge />
            </>
          )}
          {children}
        </SessionProvider>
      </WalletProvider>
    </WalletReadyProvider>
  );
}
