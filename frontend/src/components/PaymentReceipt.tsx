import { useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Receipt,
} from "lucide-react";
import type { PaymentLine, PaymentReceiptMeta } from "@/lib/api";
import { LORA_TESTNET_BASE, loraTransactionUrl } from "@/lib/explorer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function lineTotalUsd(lines: PaymentLine[]): number {
  return lines.reduce((sum, row) => {
    if (typeof row.amount_usd === "number") return sum + row.amount_usd;
    const n = parseFloat(row.price.replace(/[^0-9.]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0.01);
  }, 0);
}

function shortAddress(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function formatReceiptDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy");
  }
}

function ReceiptDetails({
  lines,
  receipt,
  total,
  receiptId,
  issuedAt,
}: {
  lines: PaymentLine[];
  receipt?: PaymentReceiptMeta;
  total: number;
  receiptId?: string;
  issuedAt?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
      <div className="border-b border-border/70 bg-gradient-to-br from-primary/8 via-background to-muted/30 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Oscorp
            </p>
            <h4 className="mt-1 text-xl font-semibold tracking-tight">Payment receipt</h4>
            {receiptId && (
              <p className="mt-1.5 font-mono text-sm text-muted-foreground">#{receiptId}</p>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {receipt?.status ?? "Paid"}
          </span>
        </div>
      </div>

      <dl className="grid gap-4 border-b border-border/60 px-6 py-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Date
          </dt>
          <dd className="mt-1 text-base font-medium">
            {issuedAt ? formatReceiptDate(issuedAt) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Payment method
          </dt>
          <dd className="mt-1 text-base font-medium">
            {receipt?.protocol ?? "x402"} · {receipt?.currency ?? "USDC"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Network
          </dt>
          <dd className="mt-1 text-base font-medium">{receipt?.network ?? "Algorand TestNet"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Paid by
          </dt>
          <dd className="mt-1 text-base font-medium">{receipt?.payer_label ?? "Oscorp agent wallet"}</dd>
          {receipt?.payer_address && (
            <dd className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground/80">
                {shortAddress(receipt.payer_address)}
              </code>
              <button
                type="button"
                onClick={() => void copyText(receipt.payer_address!, "Wallet address")}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <a
                href={`${LORA_TESTNET_BASE}/account/${receipt.payer_address}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Account
                <ExternalLink className="h-4 w-4" />
              </a>
            </dd>
          )}
        </div>
      </dl>

      <div className="px-6 py-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Line items
        </p>
        <div className="space-y-3">
          {lines.map((row, i) => {
            const url = row.explorer_url ?? (row.tx ? loraTransactionUrl(row.tx) : null);
            const amount =
              typeof row.amount_usd === "number"
                ? row.amount_usd
                : parseFloat(row.price.replace(/[^0-9.]/g, "")) || 0.01;

            return (
              <div
                key={`${row.service}-${row.tx ?? i}`}
                className="rounded-xl border border-border/60 bg-muted/25 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">{row.service}</p>
                    {row.description && (
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {row.description}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {row.sku && (
                        <span>
                          SKU <span className="font-mono">{row.sku}</span>
                        </span>
                      )}
                      {row.endpoint && (
                        <span>
                          API <span className="font-mono">{row.endpoint}</span>
                        </span>
                      )}
                      {row.method && <span>Via {row.method.toUpperCase()}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold tabular-nums">${amount.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Qty {row.quantity ?? 1}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      row.status === "Paid"
                        ? "bg-emerald-500/15 text-emerald-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {row.status ?? (row.tx ? "Paid" : "—")}
                  </span>
                  {row.tx && url ? (
                    <div className="flex min-w-0 flex-1 flex-col items-end gap-1.5 sm:max-w-[70%]">
                      <code className="max-w-full break-all font-mono text-xs text-foreground/75 sm:text-sm">
                        {row.tx}
                      </code>
                      <div className="flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => void copyText(row.tx!, "Transaction ID")}
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          <Copy className="h-4 w-4" />
                          Copy tx
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          View on Lora
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No on-chain tx recorded</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border/70 bg-muted/30 px-6 py-5">
        <div className="space-y-2 text-base">
          <div className="flex justify-between text-foreground/80">
            <span>Subtotal</span>
            <span className="tabular-nums font-medium">
              ${(receipt?.subtotal_usd ?? total).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-border/50 pt-3 text-lg font-semibold">
            <span>Total paid</span>
            <span className="tabular-nums text-emerald-800">
              ${total.toFixed(2)} {receipt?.currency ?? "USDC"}
            </span>
          </div>
          {receipt?.asset_id != null && (
            <p className="pt-1 text-xs text-muted-foreground">
              ASA ID {receipt.asset_id} on {receipt.network ?? "TestNet"}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-border/60 px-6 py-4">
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Micropayments settled per provider call via HTTP 402. Verify each settlement on{" "}
          <a
            href={LORA_TESTNET_BASE}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            AlgoKit Lora (TestNet)
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export function PaymentReceipt({
  lines,
  receipt,
  compact,
}: {
  lines: PaymentLine[];
  receipt?: PaymentReceiptMeta;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!lines.length) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Regenerated copy only — no new x402 charges.
      </p>
    );
  }

  const total = receipt?.total_usd ?? lineTotalUsd(lines);
  const txCount = receipt?.transaction_count ?? lines.filter((r) => r.tx).length;
  const issuedAt = receipt?.issued_at;
  const receiptId = receipt?.receipt_id;

  if (compact) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Total ≈ ${total.toFixed(2)} USDC · {lines.length} service
        {lines.length === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 rounded-2xl bg-muted/70 p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Agent spend (x402 · TestNet)
            </p>
            <p className="mt-1 text-sm text-foreground/75">
              {lines.length} provider{lines.length === 1 ? "" : "s"}
              {txCount > 0 && ` · ${txCount} settlement${txCount === 1 ? "" : "s"}`}
            </p>
            <p className="mt-0.5 text-base font-semibold text-emerald-700">
              ${total.toFixed(2)} USDC
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-secondary inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-sm"
          >
            <Receipt className="h-4 w-4" />
            Show receipt
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90vh,52rem)] max-w-2xl gap-0 overflow-hidden border-border/80 p-0 sm:rounded-2xl">
          <DialogTitle className="sr-only">Payment receipt</DialogTitle>
          <DialogDescription className="sr-only">
            x402 agent spend receipt for this draft
          </DialogDescription>
          <div className="max-h-[min(90vh,52rem)] overflow-y-auto p-4 sm:p-5">
            <ReceiptDetails
              lines={lines}
              receipt={receipt}
              total={total}
              receiptId={receiptId}
              issuedAt={issuedAt}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
