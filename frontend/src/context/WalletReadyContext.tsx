import { createContext, useContext, type ReactNode } from "react";

const WalletReadyContext = createContext(false);

export function WalletReadyProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  return <WalletReadyContext.Provider value={ready}>{children}</WalletReadyContext.Provider>;
}

export function useWalletClientReady() {
  return useContext(WalletReadyContext);
}
