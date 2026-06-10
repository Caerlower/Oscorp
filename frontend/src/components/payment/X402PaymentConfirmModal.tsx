import { useCallback, useMemo, type ReactNode } from "react";
import {
  Copy,
  FileText,
  Linkedin,
  MessageCircle,
  Newspaper,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import { AGENT_COLORS } from "@/components/mission-control/agent-colors";
import {
  IS_ALGORAND_TESTNET,
  RECIPIENT_ADDRESS,
  truncateAddress,
  USDC_ASSET_ID,
} from "@/constants/payment-constants";
import { useSession } from "@/context/SessionContext";

const FACILITATOR_HOST = "facilitator.goplausible.xyz";

function agentMeta(description: string) {
  const match = description.match(/Oscorp\s+([\w]+)\s+agent/i);
  const key = (match?.[1] ?? "agent").toLowerCase();
  const labels: Record<string, string> = {
    articles: "Articles Agent",
    linkedin: "LinkedIn Agent",
    reddit: "Reddit Agent",
    hackernews: "Hacker News Agent",
    twitter: "Twitter Agent",
    brand_voice: "Brand Voice Agent",
    competitors: "Competitors Agent",
  };
  const colors: Record<string, string> = {
    articles: AGENT_COLORS.articles,
    linkedin: AGENT_COLORS.linkedin,
    reddit: AGENT_COLORS.reddit,
    hackernews: AGENT_COLORS.hn,
    twitter: AGENT_COLORS.x,
    seo: AGENT_COLORS.seo,
  };
  const icons: Record<string, typeof FileText> = {
    articles: FileText,
    linkedin: Linkedin,
    reddit: MessageCircle,
    hackernews: Newspaper,
  };
  return {
    label: labels[key] ?? description,
    color: colors[key] ?? "var(--primary)",
    Icon: icons[key] ?? Zap,
  };
}

type DetailRow = {
  label: string;
  value: ReactNode;
  emphasize?: boolean;
  valueClassName?: string;
};

export function X402PaymentConfirmModal({
  open,
  amount,
  description,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  amount: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { walletAddress } = useSession();
  const agent = useMemo(() => agentMeta(description), [description]);
  const AgentIcon = agent.Icon;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://oscorp.app";
  const displayAmount = amount.replace(/\s*USDC$/i, "").trim() || amount;
  const networkLabel = IS_ALGORAND_TESTNET ? "TestNet" : "MainNet";

  const copyPayTo = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(RECIPIENT_ADDRESS);
    } catch {
      /* ignore */
    }
  }, []);

  const details: DetailRow[] = [
    { label: "Protocol", value: "x402 / Algorand" },
    {
      label: "Network",
      value: (
        <span className="inline-flex items-center justify-end gap-1.5 font-mono text-[13px] font-semibold">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
          {networkLabel}
        </span>
      ),
    },
    { label: "Asset", value: `USDC (ASA ${USDC_ASSET_ID})` },
    { label: "Amount", value: amount, emphasize: true },
    {
      label: "Pay To",
      value: (
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="font-mono text-[13px] font-semibold text-primary">
            {truncateAddress(RECIPIENT_ADDRESS)}
          </span>
          <button
            type="button"
            onClick={() => void copyPayTo()}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Copy treasury address"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </span>
      ),
    },
    {
      label: "From",
      value: walletAddress ? truncateAddress(walletAddress) : "—",
    },
    { label: "Facilitator", value: FACILITATOR_HOST },
    { label: "Max Timeout", value: "60 seconds" },
    { label: "Network Fee", value: "Paid by facilitator" },
  ];

  if (!open) return null;

  return (
    <div
      className="mc-txn-approval-root fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[8px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="x402-payment-title"
        className="mc-txn-approval-modal flex max-h-[90vh] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-secondary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-border px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={onCancel}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <p id="x402-payment-title" className="pr-10 font-display text-lg font-bold leading-tight text-foreground">
            Confirm x402 Payment
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Pay {amount} to unlock {agent.label} via the x402 protocol.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
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

          <div className="mt-3 flex items-center justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-foreground"
                style={{ backgroundColor: agent.color }}
              >
                <AgentIcon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-foreground">{agent.label}</p>
                <p className="text-xs text-muted-foreground">via x402 protocol</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-base font-bold text-primary">{displayAmount}</p>
              <p className="text-[11px] text-muted-foreground">USDC</p>
            </div>
          </div>

          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Transaction details
          </p>
          <dl className="divide-y divide-border">
            {details.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {row.label}
                </dt>
                <dd
                  className={
                    row.valueClassName ??
                    (row.emphasize
                      ? "text-right font-display text-base font-bold text-primary"
                      : "text-right font-mono text-[13px] font-semibold text-foreground")
                  }
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-primary/20 border-l-[3px] border-l-primary bg-primary/5 py-3 pl-3 pr-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <p className="text-xs italic text-muted-foreground">
              Payment verified and settled on-chain via the x402 facilitator before content is unlocked.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2.5 border-t border-border px-5 py-4">
          <button type="button" onClick={onCancel} className="mc-btn-secondary h-11 flex-1 text-sm font-medium">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="mc-btn-primary inline-flex h-11 flex-1 items-center justify-center gap-2 text-sm font-medium"
          >
            <Zap className="h-4 w-4" />
            Pay {amount}
          </button>
        </div>
      </div>
    </div>
  );
}
