import { createContext, useContext } from "react";
import type { TransactionSignerApi } from "@/hooks/useTransactionSigner";

export const TransactionSignerContext = createContext<TransactionSignerApi | null>(null);

export function useTransactionSignerContext() {
  const ctx = useContext(TransactionSignerContext);
  if (!ctx) {
    throw new Error("useTransactionSignerContext must be used within PaymentProvider");
  }
  return ctx;
}
