import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { api, type AgentStatus } from "@/lib/api";

const STORAGE_KEY = "oscorp_session";

type StoredSession = {
  userId: string;
  walletAddress: string;
};

type SessionContextValue = {
  userId: string | null;
  walletAddress: string | null;
  status: AgentStatus | null;
  loading: boolean;
  refresh: (overrideUserId?: string) => Promise<void>;
  setWalletSession: (walletAddress: string, userId: string) => void;
  clearSession: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function loadStored(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

/** Syncs connected wallet to backend (idempotent — reuses same agent wallet per address). */
export function SessionWalletSync() {
  const { activeAccount } = useWallet();
  const { setWalletSession, refresh, clearSession } = useSession();

  useEffect(() => {
    const addr = activeAccount?.address;
    if (!addr) return;

    let cancelled = false;
    void api
      .connectWallet(addr)
      .then((s) => {
        if (cancelled) return;
        setWalletSession(s.wallet_address, s.user_id);
        return refresh(s.user_id);
      })
      // connect is idempotent — re-syncs user_id + agent_address from disk
      .catch(() => {
        /* backend offline */
      });

    return () => {
      cancelled = true;
    };
  }, [activeAccount?.address, setWalletSession, refresh]);

  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const stored = loadStored();
  const [userId, setUserId] = useState<string | null>(stored?.userId ?? null);
  const [walletAddress, setWalletAddress] = useState<string | null>(stored?.walletAddress ?? null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const persist = useCallback((uid: string, wallet: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId: uid, walletAddress: wallet }));
    setUserId(uid);
    setWalletAddress(wallet);
  }, []);

  const refresh = useCallback(async (overrideUserId?: string) => {
    const id = overrideUserId ?? userId;
    if (!id) return;
    setLoading(true);
    try {
      const s = await api.getSession(id);
      setStatus(s);
      if (overrideUserId) {
        persist(id, s.wallet_address);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      if (msg.includes("not found") || msg.includes("404")) {
        localStorage.removeItem(STORAGE_KEY);
        setUserId(null);
        setWalletAddress(null);
        setStatus(null);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, persist]);

  useEffect(() => {
    if (userId) void refresh();
  }, [userId, refresh]);

  const setWalletSession = useCallback(
    (wallet: string, uid: string) => {
      persist(uid, wallet);
    },
    [persist],
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUserId(null);
    setWalletAddress(null);
    setStatus(null);
  }, []);

  const value = useMemo(
    () => ({
      userId,
      walletAddress,
      status,
      loading,
      refresh,
      setWalletSession,
      clearSession,
    }),
    [userId, walletAddress, status, loading, refresh, setWalletSession, clearSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
