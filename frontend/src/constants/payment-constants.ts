import paymentManifest from "../../shared/payment-constants.json";

const paidAgentKeys = paymentManifest.paidAgents as readonly string[];
const agentPriceEntries = paymentManifest.agentPrices as Record<string, number>;

/** Treasury address — sourced from shared/payment-constants.json. */
export const RECIPIENT_ADDRESS = paymentManifest.recipientAddress;

export const ALGORAND_NETWORK = (
  import.meta.env.VITE_ALGORAND_NETWORK ?? "testnet"
).toLowerCase();

export const IS_ALGORAND_TESTNET = ALGORAND_NETWORK !== "mainnet";

export const USDC_ASSET_ID = Number(
  import.meta.env.VITE_USDC_ASSET_ID ?? (IS_ALGORAND_TESTNET ? 10458941 : 31566704),
);
export const ALGOD_URL =
  import.meta.env.VITE_ALGOD_URL ??
  (IS_ALGORAND_TESTNET
    ? "https://testnet-api.algonode.cloud"
    : "https://mainnet-api.algonode.cloud");
export const ALGOD_TOKEN = import.meta.env.VITE_ALGOD_TOKEN ?? "";

export const ALGORAND_EXPLORER_URL = IS_ALGORAND_TESTNET
  ? "https://lora.algokit.io/testnet"
  : "https://lora.algokit.io/mainnet";

export const MIN_ALGO_MICRO = 200_000;

/** Algorand min balance: 0.1 ALGO base account + 0.1 ALGO per opted-in asset. */
export const ALGO_BASE_MBR_MICRO = 100_000;
export const ALGO_ASSET_MBR_MICRO = 100_000;

/** Agent wallet holding USDC needs 0.2 ALGO minimum balance (before tx fees). */
export const MIN_AGENT_ALGO_MBR_MICRO = ALGO_BASE_MBR_MICRO + ALGO_ASSET_MBR_MICRO;

/** Extra spendable ALGO above MBR so opt-in and transfer fees can be paid. */
export const AGENT_ALGO_FEE_BUFFER_MICRO = 50_000;

/** Target ALGO on agent wallet when funding (MBR + fee headroom). */
export const MIN_AGENT_ALGO_MICRO =
  MIN_AGENT_ALGO_MBR_MICRO + AGENT_ALGO_FEE_BUFFER_MICRO;

/** Minimum ALGO before USDC opt-in can succeed (MBR + opt-in tx fee). */
export const MIN_AGENT_ALGO_FOR_OPTIN_MICRO = MIN_AGENT_ALGO_MBR_MICRO + 5_000;

export type PaidAgent = (typeof paymentManifest.paidAgents)[number];

export const AGENT_PRICES = Object.fromEntries(
  paidAgentKeys.map((key) => [key, agentPriceEntries[key] ?? 0]),
) as Record<PaidAgent, number>;

export function formatUsdc(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function usdcToMicro(amount: number): number {
  return Math.round(amount * 1_000_000);
}

/** AlgoKit Lora explorer link for a confirmed on-chain transaction. */
export function explorerTxUrl(txHash: string): string | null {
  const hash = txHash.trim();
  if (!hash || hash.startsWith("batch-") || hash.length < 40) return null;
  return `${ALGORAND_EXPLORER_URL}/transaction/${hash}`;
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
