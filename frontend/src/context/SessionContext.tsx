import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type AgentStatus } from "@/services/api";
import {
  addressesMatch,
  readLastWalletId,
  SESSION_STORAGE_KEY,
  type Web3AuthLinkState,
} from "@/services/auth";
import { WalletId } from "@txnlab/use-wallet";
import { getWeb3AuthAddressIfConnected, logoutWeb3AuthDirect } from "@/services/web3auth-connect";

type StoredSession = {
  userId: string;
  walletAddress: string;
};

type SessionContextValue = {
  userId: string | null;
  walletAddress: string | null;
  status: AgentStatus | null;
  loading: boolean;
  sessionReady: boolean;
  web3authLink: Web3AuthLinkState;
  refresh: (overrideUserId?: string) => Promise<void>;
  setWalletSession: (walletAddress: string, userId: string) => void;
  clearSession: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function loadStored(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [web3authLink, setWeb3authLink] = useState<Web3AuthLinkState>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setUserId(null);
    setWalletAddress(null);
    setStatus(null);
    setWeb3authLink(null);
  }, []);

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      setUserId(stored.userId);
      setWalletAddress(stored.walletAddress);
    }
    setSessionReady(true);
  }, []);

  const persist = useCallback((uid: string, wallet: string) => {
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ userId: uid, walletAddress: wallet }),
    );
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
      persist(id, s.wallet_address);
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      if (msg.includes("not found") || msg.includes("404")) {
        if (walletAddress) {
          try {
            const conn = await api.connectWallet(walletAddress);
            const recovered = await api.getSession(conn.user_id);
            setStatus(recovered);
            persist(conn.user_id, walletAddress);
            return;
          } catch {
            /* stale session id — clear and sign in again */
          }
        }
        clearSession();
      } else if (walletAddress) {
        setStatus((prev) =>
          prev ?? {
            user_id: id,
            wallet_address: walletAddress,
            agent_address: "",
            policy_signed: false,
            agent_funded: false,
            usdc_micro: 0,
            usdc_opted_in: false,
            algo_micro: 0,
            min_fund_micro_usdc: 0,
            policy: null,
            spend_cap_micro_usdc: 0,
          },
        );
      }
    } finally {
      setLoading(false);
    }
  }, [userId, walletAddress, persist, clearSession]);

  useEffect(() => {
    if (userId && sessionReady) void refresh();
  }, [userId, sessionReady]); // eslint-disable-line react-hooks/exhaustive-deps -- refresh once when stored session loads

  useEffect(() => {
    if (!sessionReady) return;

    if (readLastWalletId() !== WalletId.WEB3AUTH) {
      setWeb3authLink(true);
      return;
    }

    if (!walletAddress) {
      setWeb3authLink(null);
      return;
    }

    let cancelled = false;
    setWeb3authLink(null);

    void (async () => {
      const live = await getWeb3AuthAddressIfConnected();
      if (cancelled) return;

      if (!live) {
        setWeb3authLink(false);
        return;
      }

      if (!addressesMatch(walletAddress, live)) {
        clearSession();
        await logoutWeb3AuthDirect();
        setWeb3authLink(false);
        return;
      }

      setWeb3authLink(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionReady, walletAddress, clearSession]);

  const setWalletSession = useCallback(
    (wallet: string, uid: string) => {
      persist(uid, wallet);
      if (readLastWalletId() === WalletId.WEB3AUTH) {
        setWeb3authLink(true);
      }
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      userId,
      walletAddress,
      status,
      loading,
      sessionReady,
      web3authLink,
      refresh,
      setWalletSession,
      clearSession,
    }),
    [userId, walletAddress, status, loading, sessionReady, web3authLink, refresh, setWalletSession, clearSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
