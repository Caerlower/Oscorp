export type PaymentMode = "per_action" | "agent_wallet";

/** Legacy Supabase rows may still use `batch` — treat as agent wallet mode. */
export function normalizePaymentMode(mode: string | undefined | null): PaymentMode {
  if (mode === "agent_wallet" || mode === "batch") return "agent_wallet";
  return "per_action";
}

export function isAgentWalletMode(mode: string | undefined | null): boolean {
  return normalizePaymentMode(mode) === "agent_wallet";
}

export type PaymentUser = {
  id: string;
  wallet_address: string;
  payment_mode: PaymentMode;
  agent_wallet_address?: string | null;
  agent_wallet_usdc_balance?: number;
  /** @deprecated Legacy batch fields — no longer used for payments */
  batch_budget_usdc?: number;
  batch_spent_usdc?: number;
  onboarding_completed: boolean;
  product_site?: string | null;
  created_at?: string;
};

export type PaymentTransaction = {
  id: string;
  user_id: string;
  agent: string;
  amount_usdc: number;
  tx_hash: string;
  status: "pending" | "confirmed" | "failed";
  payment_mode: PaymentMode | "batch" | "x402_per_action" | "x402_batch";
  from_address?: string | null;
  to_address?: string | null;
  agent_wallet_address?: string | null;
  created_at?: string;
};

export function transactionPaymentModeLabel(mode: string): string {
  if (mode === "agent_wallet" || mode === "batch" || mode === "x402_batch") return "Agent Wallet";
  if (mode === "x402_per_action") return "x402 per-action";
  return "Per-action";
}

/** Used when Supabase/user API is unreachable so the dashboard is not blocked. */
export function fallbackPaymentUser(walletAddress: string): PaymentUser {
  return {
    id: `local-${walletAddress.slice(0, 12)}`,
    wallet_address: walletAddress,
    payment_mode: "per_action",
    agent_wallet_address: null,
    agent_wallet_usdc_balance: 0,
    onboarding_completed: false,
  };
}
