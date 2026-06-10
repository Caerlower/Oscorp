import { type ReactNode, useEffect, useState } from "react";
import { NetworkId, WalletManager } from "@txnlab/use-wallet";
import { WalletProvider } from "@txnlab/use-wallet-react";
import { buildWalletManagerConfig } from "@/constants/wallet-config";
import { PaymentProvider } from "@/context/PaymentContext";
import { PaymentUserProvider } from "@/context/PaymentUserContext";
import { SessionProvider } from "@/context/SessionContext";
import { WalletReadyProvider } from "@/context/WalletReadyContext";
import { WalletSessionBridge } from "@/components/wallet/session-bridge";
import { hasWeb3AuthConfig } from "@/constants/wallet-config";
import { preloadNativeWalletDeps, preloadWeb3AuthDeps } from "@/utils/preload-wallet-deps";

function ssrManager() {
  return new WalletManager({ wallets: [], defaultNetwork: NetworkId.TESTNET });
}

export function WalletProviders({ children }: { children: ReactNode }) {
  const [manager, setManager] = useState<WalletManager>(ssrManager);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void import("@/utils/polyfills").then(() => {
      if (cancelled) return;
      setManager(new WalletManager(buildWalletManagerConfig()));
      setClientReady(true);
      preloadNativeWalletDeps();
      if (hasWeb3AuthConfig()) {
        void preloadWeb3AuthDeps();
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WalletReadyProvider ready={clientReady}>
      <WalletProvider key={clientReady ? "client" : "ssr"} manager={manager}>
        <SessionProvider>
          <PaymentUserProvider>
            <PaymentProvider>
              {clientReady && <WalletSessionBridge />}
              {children}
            </PaymentProvider>
          </PaymentUserProvider>
        </SessionProvider>
      </WalletProvider>
    </WalletReadyProvider>
  );
}
