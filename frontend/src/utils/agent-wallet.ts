import algosdk from "algosdk";
import {
  buildUsdcOptInTx,
  buildUsdcTransferTx,
  fetchAccountBalances,
  submitSignedTx,
  type AccountBalances,
} from "@/utils/algorand-wallet";
import {
  ALGOD_TOKEN,
  ALGOD_URL,
  MIN_AGENT_ALGO_FOR_OPTIN_MICRO,
  MIN_AGENT_ALGO_MBR_MICRO,
  MIN_AGENT_ALGO_MICRO,
  RECIPIENT_ADDRESS,
  usdcToMicro,
} from "@/constants/payment-constants";
import { deriveAgentWalletFromSession } from "@/services/web3auth-connect";

export type FundMainTxnKind = "algo" | "usdc";

export type AgentFundingPlan = {
  agentAddress: string;
  usdcAmount: number;
  /** ALGO micro-units to send from main → agent (0 if agent already has enough). */
  algoToSendMicro: number;
  needsUsdcOptIn: boolean;
  agentAlgoMicro: number;
  agentUsdcOptedIn: boolean;
};

const MAIN_ALGO_FEE_BUFFER_MICRO = 50_000;

/** Agent already received the base 0.2 ALGO funding (ALGO step done). */
export function agentAlgoFundingComplete(algoMicro: number): boolean {
  return algoMicro >= MIN_AGENT_ALGO_MBR_MICRO;
}

/** Agent has enough ALGO to attempt USDC opt-in without another top-up. */
export function agentHasEnoughAlgoForOptIn(algoMicro: number): boolean {
  return algoMicro >= MIN_AGENT_ALGO_FOR_OPTIN_MICRO;
}

/** ALGO micro-units needed on agent wallet before a USDC top-up (0 if already sufficient). */
export function computeAlgoTopUpNeeded(balances: AccountBalances): number {
  if (balances.usdcOptedIn) {
    return Math.max(0, MIN_AGENT_ALGO_MBR_MICRO - balances.algoMicro);
  }
  if (agentAlgoFundingComplete(balances.algoMicro)) {
    return 0;
  }
  return Math.max(0, MIN_AGENT_ALGO_MICRO - balances.algoMicro);
}

export type FundAgentWalletOptions = {
  /** Override ALGO top-up (microAlgos). Use 0 to skip ALGO transfer. */
  algoTopUpMicro?: number;
};

/** True when agent still needs the initial ALGO funding (no USDC, below 0.2 ALGO). */
export function isAgentWalletFullSetup(plan: AgentFundingPlan): boolean {
  return plan.needsUsdcOptIn && !agentAlgoFundingComplete(plan.agentAlgoMicro);
}

/** True when ALGO is already funded but USDC opt-in + transfer still needed. */
export function isAgentWalletResumeSetup(plan: AgentFundingPlan): boolean {
  return plan.needsUsdcOptIn && agentAlgoFundingComplete(plan.agentAlgoMicro);
}

export async function getAgentWalletBalances(address: string) {
  return fetchAccountBalances(address);
}

export async function buildAlgoTransferTx(
  from: string,
  to: string,
  algoMicro: number,
): Promise<algosdk.Transaction> {
  const client = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");
  const params = await client.getTransactionParams().do();
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: from,
    receiver: to,
    amount: algoMicro,
    suggestedParams: params,
  });
}

export async function planAgentWalletFunding(
  mainAddress: string,
  amountUsdc: number,
  agentAddress?: string,
): Promise<AgentFundingPlan> {
  const agent = agentAddress
    ? { address: agentAddress }
    : await deriveAgentWalletFromSession();
  const agentBalances = await fetchAccountBalances(agent.address);

  const algoToSendMicro = computeAlgoTopUpNeeded(agentBalances);

  return {
    agentAddress: agent.address,
    usdcAmount: amountUsdc,
    algoToSendMicro,
    needsUsdcOptIn: !agentBalances.usdcOptedIn,
    agentAlgoMicro: agentBalances.algoMicro,
    agentUsdcOptedIn: agentBalances.usdcOptedIn,
  };
}

export function validateAgentAlgoTopUp(
  plan: AgentFundingPlan,
  algoTopUpMicro: number,
): { ok: true } | { ok: false; message: string } {
  if (algoTopUpMicro <= 0) {
    if (plan.needsUsdcOptIn && !agentAlgoFundingComplete(plan.agentAlgoMicro)) {
      const neededMicro = MIN_AGENT_ALGO_MBR_MICRO - plan.agentAlgoMicro;
      return {
        ok: false,
        message: `Agent wallet needs at least ${(MIN_AGENT_ALGO_MBR_MICRO / 1_000_000).toFixed(2)} ALGO for USDC opt-in. Send ${(neededMicro / 1_000_000).toFixed(2)} ALGO or more.`,
      };
    }
    return { ok: true };
  }

  const afterTopUp = plan.agentAlgoMicro + algoTopUpMicro;
  if (plan.needsUsdcOptIn && afterTopUp < MIN_AGENT_ALGO_MICRO) {
    const neededMicro = MIN_AGENT_ALGO_MICRO - plan.agentAlgoMicro;
    return {
      ok: false,
      message: `Agent wallet needs ${(MIN_AGENT_ALGO_MICRO / 1_000_000).toFixed(2)} ALGO total for USDC opt-in (currently ${(plan.agentAlgoMicro / 1_000_000).toFixed(3)} ALGO). Send at least ${(neededMicro / 1_000_000).toFixed(2)} ALGO.`,
    };
  }
  if (!plan.needsUsdcOptIn && afterTopUp < MIN_AGENT_ALGO_MBR_MICRO) {
    return {
      ok: false,
      message: `Agent wallet needs at least ${(MIN_AGENT_ALGO_MBR_MICRO / 1_000_000).toFixed(2)} ALGO after top-up.`,
    };
  }
  return { ok: true };
}

export function validateMainWalletForAgentFunding(
  mainBalances: AccountBalances,
  plan: AgentFundingPlan,
  algoTopUpMicro?: number,
): { ok: true } | { ok: false; message: string } {
  const algoSend = algoTopUpMicro ?? plan.algoToSendMicro;
  const agentCheck = validateAgentAlgoTopUp(plan, algoSend);
  if (!agentCheck.ok) return agentCheck;

  if (!mainBalances.usdcOptedIn) {
    return { ok: false, message: "Enable USDC on your main wallet first." };
  }
  const neededUsdcMicro = usdcToMicro(plan.usdcAmount);
  if (mainBalances.usdcMicro < neededUsdcMicro) {
    return {
      ok: false,
      message: `Your main wallet needs at least $${plan.usdcAmount.toFixed(2)} USDC.`,
    };
  }
  const neededAlgoMicro = algoSend + MAIN_ALGO_FEE_BUFFER_MICRO;
  if (mainBalances.algoMicro < neededAlgoMicro) {
    return {
      ok: false,
      message: `Your main wallet needs ~${(neededAlgoMicro / 1_000_000).toFixed(2)} ALGO to cover agent fees.`,
    };
  }
  return { ok: true };
}

async function waitForAgentAlgo(agentAddress: string, minMicro: number): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const balances = await fetchAccountBalances(agentAddress);
    if (balances.algoMicro >= minMicro) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Agent wallet did not receive ALGO — try again in a moment.");
}

/** Ensure agent wallet has ALGO for fees and USDC opt-in before funding. */
export async function ensureAgentWalletReady(
  agentAddress: string,
  mainAddress: string,
  signMainTxn: (txn: algosdk.Transaction, kind: FundMainTxnKind) => Promise<string>,
  options?: FundAgentWalletOptions,
): Promise<{ algoTxId?: string; optInTxId?: string }> {
  const balances = await fetchAccountBalances(agentAddress);
  let algoTxId: string | undefined;
  const needsOptIn = !balances.usdcOptedIn;

  const algoToSend =
    options?.algoTopUpMicro !== undefined
      ? options.algoTopUpMicro
      : computeAlgoTopUpNeeded(balances);

  if (algoToSend > 0) {
    const algoTx = await buildAlgoTransferTx(mainAddress, agentAddress, algoToSend);
    algoTxId = await signMainTxn(algoTx, "algo");
    const targetMicro = needsOptIn
      ? Math.max(MIN_AGENT_ALGO_MICRO, balances.algoMicro + algoToSend)
      : Math.max(MIN_AGENT_ALGO_MBR_MICRO, balances.algoMicro + algoToSend);
    await waitForAgentAlgo(agentAddress, targetMicro);
  }

  const refreshed = await fetchAccountBalances(agentAddress);
  let optInTxId: string | undefined;
  if (!refreshed.usdcOptedIn) {
    if (!agentAlgoFundingComplete(refreshed.algoMicro)) {
      throw new Error(
        `Agent wallet has ${(refreshed.algoMicro / 1_000_000).toFixed(3)} ALGO but needs ${(MIN_AGENT_ALGO_MBR_MICRO / 1_000_000).toFixed(2)} ALGO before USDC opt-in. Send ALGO to the agent wallet and try again.`,
      );
    }
    const optInTx = await buildUsdcOptInTx(agentAddress);
    const agent = await deriveAgentWalletFromSession();
    const signed = optInTx.signTxn(agent.secretKey);
    optInTxId = await submitSignedTx(signed);
  }

  return { algoTxId, optInTxId };
}

export async function fundAgentWallet(
  mainAddress: string,
  amountUsdc: number,
  signMainTxn: (txn: algosdk.Transaction, kind: FundMainTxnKind) => Promise<string>,
  options?: FundAgentWalletOptions,
): Promise<{ algoTxId?: string; optInTxId?: string; usdcTxId: string }> {
  const agent = await deriveAgentWalletFromSession();
  const setup = await ensureAgentWalletReady(agent.address, mainAddress, signMainTxn, options);

  const txn = await buildUsdcTransferTx(mainAddress, amountUsdc, agent.address);
  const usdcTxId = await signMainTxn(txn, "usdc");

  return { ...setup, usdcTxId };
}

export async function agentWalletPay(
  agentName: string,
  amountUsdc: number,
  userId: string,
): Promise<string> {
  const agent = await deriveAgentWalletFromSession();
  const balances = await fetchAccountBalances(agent.address);

  if (!balances.usdcOptedIn || balances.usdcMicro < usdcToMicro(amountUsdc)) {
    throw new Error("AGENT_WALLET_LOW_BALANCE");
  }

  if (balances.algoMicro < MIN_AGENT_ALGO_MBR_MICRO + 5_000) {
    throw new Error("AGENT_WALLET_LOW_ALGO");
  }

  const txn = await buildUsdcTransferTx(
    agent.address,
    amountUsdc,
    RECIPIENT_ADDRESS,
    new TextEncoder().encode(JSON.stringify({ agent: agentName, userId })),
  );

  const signed = txn.signTxn(agent.secretKey);
  return submitSignedTx(signed);
}

export async function withdrawAgentWallet(mainAddress: string): Promise<string> {
  const agent = await deriveAgentWalletFromSession();
  const balances = await fetchAccountBalances(agent.address);

  if (!balances.usdcOptedIn || balances.usdcMicro <= 0) {
    throw new Error("AGENT_WALLET_EMPTY");
  }

  if (balances.algoMicro < MIN_AGENT_ALGO_MBR_MICRO + 5_000) {
    throw new Error("AGENT_WALLET_LOW_ALGO");
  }

  const txn = await buildUsdcTransferTx(
    agent.address,
    balances.usdcMicro / 1_000_000,
    mainAddress,
    new TextEncoder().encode("oscorp-agent-wallet-withdrawal"),
  );

  const signed = txn.signTxn(agent.secretKey);
  return submitSignedTx(signed);
}

export { RECIPIENT_ADDRESS };
