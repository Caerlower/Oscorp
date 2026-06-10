import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { usePaymentUser } from "@/context/PaymentUserContext";
import { fetchAccountBalances } from "@/utils/algorand-wallet";

export type WalletUsdcBalances = {
  mainUsdc: number | null;
  agentUsdc: number | null;
  loading: boolean;
  error: boolean;
};

function microToUsdc(micro: number): number {
  return micro / 1_000_000;
}

export function useWalletUsdcBalances(refreshIntervalMs = 30_000): WalletUsdcBalances {
  const { walletAddress } = useSession();
  const { user } = usePaymentUser();
  const agentAddress = user?.agent_wallet_address ?? null;

  const [mainUsdc, setMainUsdc] = useState<number | null>(null);
  const [agentUsdc, setAgentUsdc] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const initialLoadRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setMainUsdc(null);
      setAgentUsdc(null);
      setLoading(false);
      setError(false);
      initialLoadRef.current = false;
      return;
    }

    if (initialLoadRef.current) setLoading(true);
    try {
      const main = await fetchAccountBalances(walletAddress);
      setMainUsdc(microToUsdc(main.usdcMicro));
      setError(false);

      if (agentAddress) {
        const agent = await fetchAccountBalances(agentAddress);
        setAgentUsdc(microToUsdc(agent.usdcMicro));
      } else {
        setAgentUsdc(null);
      }
    } catch {
      setError(true);
    } finally {
      initialLoadRef.current = false;
      setLoading(false);
    }
  }, [walletAddress, agentAddress]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [refresh, refreshIntervalMs]);

  return { mainUsdc, agentUsdc, loading, error };
}

export function formatUsdcDisplay(amount: number | null, loading: boolean, error: boolean): string {
  if (loading && amount === null) return "... USDC";
  if (error && amount === null) return "-- USDC";
  if (amount === null) return "-- USDC";
  return `${amount.toFixed(2)} USDC`;
}
