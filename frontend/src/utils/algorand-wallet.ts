import algosdk, { waitForConfirmation } from "algosdk";
import {
  ALGOD_TOKEN,
  ALGOD_URL,
  MIN_ALGO_MICRO,
  RECIPIENT_ADDRESS,
  USDC_ASSET_ID,
  formatUsdc,
  usdcToMicro,
} from "@/constants/payment-constants";

/** Minimum ALGO to cover a single transaction fee. */
const MIN_TX_FEE_ALGO_MICRO = 10_000;

export type PaymentReadinessIssue = "no_usdc_optin" | "insufficient_usdc" | "insufficient_algo";

export type PaymentReadiness =
  | { ok: true; balances: AccountBalances }
  | { ok: false; issue: PaymentReadinessIssue; message: string; balances: AccountBalances };

export class PaymentPreflightError extends Error {
  readonly issue: PaymentReadinessIssue;

  constructor(issue: PaymentReadinessIssue, message: string) {
    super(message);
    this.name = "PaymentPreflightError";
    this.issue = issue;
  }
}

export type AccountBalances = {
  algoMicro: number;
  usdcMicro: number;
  usdcOptedIn: boolean;
};

function algod(): algosdk.Algodv2 {
  return new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");
}

function assetIdFromHolding(asset: { assetId?: bigint | number; amount?: bigint | number }): number {
  return Number(asset.assetId ?? 0);
}

export async function fetchAccountBalances(address: string): Promise<AccountBalances> {
  const info = await algod().accountInformation(address).do();
  let usdcMicro = 0;
  let usdcOptedIn = false;
  for (const asset of info.assets ?? []) {
    if (assetIdFromHolding(asset) === USDC_ASSET_ID) {
      usdcMicro = Number(asset.amount);
      usdcOptedIn = true;
      break;
    }
  }
  return {
    algoMicro: Number(info.amount),
    usdcMicro,
    usdcOptedIn,
  };
}

export function hasMinimumAlgo(balances: AccountBalances): boolean {
  return balances.algoMicro >= MIN_ALGO_MICRO;
}

export async function checkPaymentReadiness(
  address: string,
  amountUsdc: number,
): Promise<PaymentReadiness> {
  const balances = await fetchAccountBalances(address);

  if (!balances.usdcOptedIn) {
    return {
      ok: false,
      issue: "no_usdc_optin",
      message: "Enable USDC on your wallet before paying for agents.",
      balances,
    };
  }

  const neededMicro = usdcToMicro(amountUsdc);
  if (balances.usdcMicro < neededMicro) {
    const have = formatUsdc(balances.usdcMicro / 1_000_000);
    const need = formatUsdc(amountUsdc);
    return {
      ok: false,
      issue: "insufficient_usdc",
      message: `You need ${need} USDC but only have ${have}. Fund your wallet first.`,
      balances,
    };
  }

  if (balances.algoMicro < MIN_TX_FEE_ALGO_MICRO) {
    return {
      ok: false,
      issue: "insufficient_algo",
      message: "Add ALGO to your wallet for network fees (~0.001 ALGO per transaction).",
      balances,
    };
  }

  return { ok: true, balances };
}

export async function buildUsdcTransferTx(
  from: string,
  amountUsdc: number,
  to: string = RECIPIENT_ADDRESS,
  note?: Uint8Array,
): Promise<algosdk.Transaction> {
  const client = algod();
  const params = await client.getTransactionParams().do();
  const amount = usdcToMicro(amountUsdc);
  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: from,
    receiver: to,
    amount,
    assetIndex: USDC_ASSET_ID,
    suggestedParams: params,
    note,
  });
}

export async function buildUsdcOptInTx(from: string): Promise<algosdk.Transaction> {
  return buildUsdcTransferTx(from, 0, from);
}

export async function submitSignedTx(signed: Uint8Array): Promise<string> {
  const client = algod();
  const response = await client.sendRawTransaction(signed).do();
  const txid = response.txid;
  if (!txid) {
    throw new Error("Transaction was not accepted by the network");
  }
  await waitForConfirmation(client, txid, 20);
  return txid;
}
