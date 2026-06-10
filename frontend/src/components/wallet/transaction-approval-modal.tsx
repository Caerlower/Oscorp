import { Loader2, X, Zap } from "lucide-react";
import type { TxnApprovalDetails } from "@/utils/txn-format";

export type TransactionApprovalModalProps = {
  open: boolean;
  busy?: boolean;
  approval: TxnApprovalDetails | null;
  onCancel: () => void;
  onApprove: () => void;
};

export function TransactionApprovalModal({
  open,
  busy = false,
  approval,
  onCancel,
  onApprove,
}: TransactionApprovalModalProps) {
  if (!open || !approval) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://oscorp.app";

  return (
    <div
      className="mc-txn-approval-root fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[8px]"
      onClick={busy ? undefined : onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="txn-approval-title"
        className="mc-txn-approval-modal w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-border px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <p id="txn-approval-title" className="pr-10 font-display text-lg font-bold leading-tight text-foreground">
            {approval.title}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{approval.message}</p>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <img src="/oscorp-mark.svg" alt="" className="h-4 w-4" draggable={false} />
              <span className="font-display text-sm font-bold text-foreground">Oscorp</span>
              <span className="rounded-full border border-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                Verified
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{origin}</p>
          </div>

          <dl className="mt-4 divide-y divide-border">
            {approval.details.map((row) => {
              const isAmount = row.label.toLowerCase() === "amount";
              return (
                <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd
                    className={`text-right ${
                      isAmount
                        ? "font-display text-base font-bold text-primary"
                        : "font-mono text-[13px] font-semibold text-foreground"
                    }`}
                  >
                    {row.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="flex gap-2.5 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="mc-btn-secondary h-11 flex-1 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="mc-btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm font-medium"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing…
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Approve
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
