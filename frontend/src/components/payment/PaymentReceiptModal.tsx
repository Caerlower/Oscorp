import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import {
  agentMeta,
  formatReceiptDateTime,
  receiptNetworkLabel,
  receiptShortId,
  shortenAddress,
} from "@/utils/payment-receipt";
import { explorerTxUrl, formatUsdc } from "@/constants/payment-constants";
import { transactionPaymentModeLabel, type PaymentTransaction } from "@/types/payment-user";

type PaymentReceiptModalProps = {
  tx: PaymentTransaction;
  walletAddress?: string;
  onClose: () => void;
};

function LineItem({ tx }: { tx: PaymentTransaction }) {
  const meta = agentMeta(tx.agent);
  const explorerUrl = explorerTxUrl(tx.tx_hash);
  const hasRealTx = tx.tx_hash && !tx.tx_hash.startsWith("batch-");

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="rounded-[10px] border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[15px] font-bold">{meta.title}</p>
        <p className="font-display text-sm font-bold text-primary">{formatUsdc(tx.amount_usdc)}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[`SKU ${meta.sku}`, `API ${meta.api}`, "Via x402"].map((tag) => (
          <span
            key={tag}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 border-t border-border pt-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          <Check className="h-3 w-3" />
          Paid
        </span>
        {hasRealTx && (
          <div className="mt-2 space-y-1">
            <code className="block truncate font-mono text-[11px] text-muted-foreground">{tx.tx_hash}</code>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <button
                type="button"
                onClick={() => copy(tx.tx_hash, "Transaction")}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                <Copy className="h-3 w-3" />
                Copy tx
              </button>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  View on Lora
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PaymentReceiptModal({ tx, walletAddress, onClose }: PaymentReceiptModalProps) {
  const paid = tx.status === "confirmed";
  const payerAddress = tx.from_address ?? walletAddress;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[8px]">
      <div
        role="dialog"
        aria-labelledby="payment-receipt-title"
        className="mc-receipt-modal flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-2xl border border-border bg-secondary"
      >
        <header className="relative shrink-0 border-b border-border px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close receipt"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Oscorp
              </p>
              <h2 id="payment-receipt-title" className="mt-1 font-display text-[22px] font-bold tracking-tight">
                Payment Receipt
              </h2>
              <p className="mt-1 font-mono text-xs text-muted-foreground">#{receiptShortId(tx)}</p>
            </div>
            {paid && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <Check className="h-3.5 w-3.5" />
                Paid
              </span>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Date</p>
              <p className="mt-1 text-[13px]">{formatReceiptDateTime(tx.created_at)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Payment method
              </p>
              <p className="mt-1 text-[13px] text-primary">
                x402 · USDC · {transactionPaymentModeLabel(tx.payment_mode)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Network</p>
              <p className="mt-1 text-[13px]">{receiptNetworkLabel()}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Paid by</p>
              <p className="mt-1 text-[13px]">
                {payerAddress ? shortenAddress(payerAddress) : "Your wallet"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Line items</p>
            <div className="mt-3">
              <LineItem tx={tx} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
