import { Loader2, Zap } from "lucide-react";
import { AGENT_PRICES, formatUsdc, type PaidAgent } from "@/constants/payment-constants";
import { cn } from "@/utils/utils";

export function PayAgentButton({
  agent,
  loading,
  paid,
  error,
  onClick,
  onView,
  onRetry,
  className,
}: {
  agent: PaidAgent;
  loading: boolean;
  paid?: boolean;
  error?: string | null;
  onClick: () => void;
  onView?: () => void;
  onRetry?: () => void;
  className?: string;
}) {
  const price = AGENT_PRICES[agent];
  const hasError = Boolean(error);

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/40 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing…
      </button>
    );
  }

  if (hasError) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          (onRetry ?? onClick)();
        }}
        className={cn(
          "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-destructive text-xs font-medium text-destructive transition hover:bg-destructive/5",
          className,
        )}
      >
        Retry
      </button>
    );
  }

  if (paid) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          (onView ?? onClick)();
        }}
        className={cn(
          "mc-btn-secondary inline-flex h-9 w-full items-center justify-center text-xs font-medium",
          className,
        )}
      >
        View
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn("mc-btn-primary inline-flex h-9 w-full items-center justify-center gap-1.5 text-xs font-medium", className)}
    >
      <Zap className="h-3 w-3" />
      Pay {formatUsdc(price)}
    </button>
  );
}
