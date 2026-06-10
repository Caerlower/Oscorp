import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "@/context/SessionContext";
import { usePaymentUser } from "@/hooks/usePaymentUser";
import { api } from "@/services/api";
import type { PaidAgent } from "@/constants/payment-constants";
import type { PaymentTransaction } from "@/types/payment-user";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const TRACKED_AGENTS: PaidAgent[] = ["reddit", "linkedin", "articles", "hackernews"];

function isRecentConfirmed(tx: PaymentTransaction): boolean {
  if (tx.status !== "confirmed") return false;
  const created = new Date(tx.created_at).getTime();
  return Number.isFinite(created) && Date.now() - created < TWENTY_FOUR_HOURS_MS;
}

type PaidAgentsContextValue = {
  isAgentPaid: (agent: PaidAgent) => boolean;
  markAgentPaid: (agent: PaidAgent) => void;
  unmarkAgentPaid: (agent: PaidAgent) => void;
  refreshPaidAgents: (options?: { silent?: boolean }) => Promise<void>;
  loading: boolean;
};

const PaidAgentsContext = createContext<PaidAgentsContextValue | null>(null);

export function PaidAgentsProvider({ children }: { children: ReactNode }) {
  const { walletAddress, sessionReady } = useSession();
  const { user } = usePaymentUser();
  const paymentUserId = user?.id;
  const [confirmedAgents, setConfirmedAgents] = useState<Set<PaidAgent>>(new Set());
  const [instantPaid, setInstantPaid] = useState<Set<PaidAgent>>(new Set());
  const [loading, setLoading] = useState(false);

  const refreshPaidAgents = useCallback(async (options?: { silent?: boolean }) => {
    if (!sessionReady || !walletAddress || !paymentUserId || paymentUserId.startsWith("local-")) {
      setConfirmedAgents(new Set());
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const rows = await api.listTransactions(paymentUserId, { limit: 100, offset: 0 });
      const paid = new Set<PaidAgent>();
      for (const tx of rows) {
        if (!isRecentConfirmed(tx)) continue;
        const agent = tx.agent as PaidAgent;
        if ((TRACKED_AGENTS as readonly string[]).includes(agent)) {
          paid.add(agent);
        }
      }
      setConfirmedAgents(paid);
    } catch {
      /* keep prior state */
    } finally {
      setLoading(false);
    }
  }, [paymentUserId, sessionReady, walletAddress]);

  useEffect(() => {
    setInstantPaid(new Set());
    void refreshPaidAgents();
  }, [refreshPaidAgents]);

  const markAgentPaid = useCallback((agent: PaidAgent) => {
    setInstantPaid((prev) => {
      const next = new Set(prev);
      next.add(agent);
      return next;
    });
    setConfirmedAgents((prev) => {
      const next = new Set(prev);
      next.add(agent);
      return next;
    });
  }, []);

  const unmarkAgentPaid = useCallback((agent: PaidAgent) => {
    setInstantPaid((prev) => {
      const next = new Set(prev);
      next.delete(agent);
      return next;
    });
    setConfirmedAgents((prev) => {
      const next = new Set(prev);
      next.delete(agent);
      return next;
    });
  }, []);

  const isAgentPaid = useCallback(
    (agent: PaidAgent) => instantPaid.has(agent) || confirmedAgents.has(agent),
    [confirmedAgents, instantPaid],
  );

  const value = useMemo(
    () => ({ isAgentPaid, markAgentPaid, unmarkAgentPaid, refreshPaidAgents, loading }),
    [isAgentPaid, markAgentPaid, unmarkAgentPaid, refreshPaidAgents, loading],
  );

  return <PaidAgentsContext.Provider value={value}>{children}</PaidAgentsContext.Provider>;
}

export function usePaidAgents() {
  const ctx = useContext(PaidAgentsContext);
  if (!ctx) throw new Error("usePaidAgents must be used within PaidAgentsProvider");
  return ctx;
}
