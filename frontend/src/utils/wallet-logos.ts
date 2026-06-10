import { WalletId } from "@txnlab/use-wallet";

export const WALLET_BRANDS = [
  {
    id: WalletId.PERA,
    name: "Pera Wallet",
    logoSrc: "/wallets/pera.svg",
  },
  {
    id: WalletId.DEFLY,
    name: "Defly Wallet",
    logoSrc: "/wallets/defly.svg",
  },
  {
    id: WalletId.LUTE,
    name: "Lute Wallet",
    logoSrc: "/wallets/lute.svg",
  },
] as const;
