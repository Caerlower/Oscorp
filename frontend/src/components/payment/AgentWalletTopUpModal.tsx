import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { formatUsdc } from "@/constants/payment-constants";

export function AgentWalletTopUpModal({
  open,
  shortfall,
  busy,
  onTopUp,
  onCancel,
}: {
  open: boolean;
  shortfall: number;
  busy: boolean;
  onTopUp: (amount: number) => void;
  onCancel: () => void;
}) {
  const suggested = Math.max(1, Math.ceil(shortfall * 100) / 100);
  const [amount, setAmount] = useState(suggested);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px]"
      onClick={busy ? undefined : onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="pr-6">
            <p className="text-base font-semibold">Top up agent wallet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your agent wallet needs at least {formatUsdc(shortfall)} more USDC to run this action.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-5 rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fund amount (USDC)
          </label>
          <input
            type="number"
            min={1}
            step={0.5}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="field-input mt-2 rounded-xl text-sm"
          />
          <div className="mt-2 flex gap-2">
            {[1, 2, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(n)}
                className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
              >
                ${n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2.5 px-5 py-5">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || amount < 1}
            onClick={() => onTopUp(amount)}
            className="auth-btn-primary flex flex-1 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              "Fund agent wallet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
