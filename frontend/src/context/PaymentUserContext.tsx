import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/context/SessionContext";
import { api } from "@/services/api";
import { clearLegacySiteStorage, clearStoredSite, storeSite } from "@/utils/navigation";
import { isValidSite } from "@/utils/navigation";
import {
  fallbackPaymentUser,
  normalizePaymentMode,
  type PaymentUser,
} from "@/types/payment-user";

type PaymentUserContextValue = {
  user: PaymentUser | null;
  loading: boolean;
  ready: boolean;
  error: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<PaymentUser | null>;
  updateUser: (
    patch: Partial<
      Pick<
        PaymentUser,
        | "payment_mode"
        | "agent_wallet_address"
        | "agent_wallet_usdc_balance"
        | "batch_budget_usdc"
        | "batch_spent_usdc"
        | "onboarding_completed"
        | "product_site"
      >
    >,
  ) => Promise<PaymentUser>;
};

const PaymentUserContext = createContext<PaymentUserContextValue | null>(null);

export function PaymentUserProvider({ children }: { children: ReactNode }) {
  const { walletAddress, sessionReady } = useSession();
  const [user, setUser] = useState<PaymentUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastWalletRef = useRef<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }): Promise<PaymentUser | null> => {
    if (!walletAddress) {
      setUser(null);
      setError(null);
      setReady(true);
      setLoading(false);
      lastWalletRef.current = null;
      return null;
    }

    clearLegacySiteStorage();

    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const record = await api.getPaymentUser(walletAddress);
      const normalized: PaymentUser = {
        ...record,
        payment_mode: normalizePaymentMode(record.payment_mode),
      };
      if (normalized.product_site && isValidSite(normalized.product_site)) {
        storeSite(normalized.product_site, walletAddress);
      } else {
        clearStoredSite(walletAddress);
      }
      setUser(normalized);
      lastWalletRef.current = walletAddress;
      return normalized;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load payment profile";
      setError(msg);
      const fallback = fallbackPaymentUser(walletAddress);
      setUser(fallback);
      lastWalletRef.current = walletAddress;
      return fallback;
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!sessionReady) return;

    if (!walletAddress) {
      setUser(null);
      setReady(true);
      setLoading(false);
      lastWalletRef.current = null;
      clearLegacySiteStorage();
      return;
    }

    if (lastWalletRef.current === walletAddress) {
      setReady(true);
      return;
    }

    void refresh();
  }, [sessionReady, walletAddress, refresh]);

  const updateUser = useCallback(
    async (
      patch: Partial<
        Pick<
          PaymentUser,
          | "payment_mode"
          | "agent_wallet_address"
          | "agent_wallet_usdc_balance"
          | "batch_budget_usdc"
          | "batch_spent_usdc"
          | "onboarding_completed"
          | "product_site"
        >
      >,
    ) => {
      if (!user?.id) throw new Error("No payment user");
      try {
        const updated = await api.updatePaymentUser(user.id, patch);
        const normalized: PaymentUser = {
          ...updated,
          payment_mode: normalizePaymentMode(updated.payment_mode),
        };
        if (walletAddress) {
          if (normalized.product_site && isValidSite(normalized.product_site)) {
            storeSite(normalized.product_site, walletAddress);
          } else if (patch.product_site !== undefined) {
            clearStoredSite(walletAddress);
          }
        }
        setUser(normalized);
        return normalized;
      } catch (e) {
        const merged: PaymentUser = {
          ...user,
          ...patch,
          payment_mode: normalizePaymentMode(patch.payment_mode ?? user.payment_mode),
        };
        setUser(merged);
        throw e;
      }
    },
    [user, walletAddress],
  );

  return (
    <PaymentUserContext.Provider value={{ user, loading, ready, error, refresh, updateUser }}>
      {children}
    </PaymentUserContext.Provider>
  );
}

export function usePaymentUser(): PaymentUserContextValue {
  const ctx = useContext(PaymentUserContext);
  if (!ctx) {
    throw new Error("usePaymentUser must be used within PaymentUserProvider");
  }
  return ctx;
}
