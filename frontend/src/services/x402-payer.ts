import { x402Client, x402HTTPClient } from "@x402-avm/core/client";
import type { ClientAvmSigner } from "@x402-avm/avm";
import { wrapFetchWithPayment } from "@x402-avm/fetch";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";
import type { PaymentRequirements, SettleResponse } from "@x402-avm/core/types";

export type { ClientAvmSigner };

export type X402FetchOptions = {
  /** Return false to cancel before the wallet signs the x402 payment. */
  onPaymentRequired?: (amountLabel: string, description: string) => Promise<boolean>;
  /** Called after facilitator settlement with the on-chain transaction id. */
  onPaymentComplete?: (txId: string, description: string) => void;
  /** Algod URL for building x402 payment transactions (defaults to public testnet). */
  algodUrl?: string;
  algodToken?: string;
};

/**
 * Creates an x402-enabled fetch that handles HTTP 402 responses automatically:
 * parse PAYMENT-REQUIRED → sign Algorand payment → retry with PAYMENT-SIGNATURE.
 */
export function createX402Fetch(
  signer: ClientAvmSigner,
  options: X402FetchOptions = {},
  fetchImpl: typeof fetch = fetch,
) {
  const client = new x402Client();

  client.onBeforePaymentCreation(async (context: {
    paymentRequired: { resource?: { description?: string } };
    selectedRequirements: PaymentRequirements;
  }) => {
    if (!options.onPaymentRequired) return;
    const req = context.selectedRequirements;
    const micro = Number.parseInt(req.amount, 10);
    const amountLabel = `$${(micro / 1_000_000).toFixed(2)} USDC`;
    const description =
      context.paymentRequired.resource?.description ?? req.extra?.name?.toString() ?? "agent";
    const approved = await options.onPaymentRequired(amountLabel, description);
    if (!approved) {
      return { abort: true, reason: "Payment cancelled" };
    }
  });

  registerExactAvmScheme(client, {
    signer,
    algodConfig:
      options.algodUrl || options.algodToken
        ? { algodUrl: options.algodUrl, algodToken: options.algodToken }
        : undefined,
  });
  const httpClient = new x402HTTPClient(client);
  const fetchWithPayment = wrapFetchWithPayment(fetchImpl, httpClient);

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetchWithPayment(input, init);
    if (response.ok && options.onPaymentComplete) {
      try {
        const settle = httpClient.getPaymentSettleResponse((name: string) => response.headers.get(name));
        const description = settleDescriptionFromResponse(response, settle);
        if (settle.transaction) {
          options.onPaymentComplete(settle.transaction, description);
        }
      } catch {
        /* unpaid or header not present */
      }
    }
    return response;
  };
}

function settleDescriptionFromResponse(response: Response, settle: SettleResponse): string {
  const fromHeader = response.headers.get("x-oscorp-agent");
  if (fromHeader) return fromHeader;
  return settle.network ?? "agent";
}
