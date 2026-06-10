import { createContext, useContext } from "react";
import type { usePayment } from "@/hooks/usePayment";

export type PaymentContextValue = ReturnType<typeof usePayment>;

export const PaymentContext = createContext<PaymentContextValue | null>(null);

export function usePaymentContext() {
  const ctx = useContext(PaymentContext);
  if (!ctx) throw new Error("usePaymentContext must be used within PaymentProvider");
  return ctx;
}
