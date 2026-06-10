import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Linkedin,
  Loader2,
  MessageCircle,
  Newspaper,
  Receipt,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentReceiptModal } from "@/components/payment/PaymentReceiptModal";
import { useSession } from "@/context/SessionContext";
import { usePaymentUser } from "@/context/PaymentUserContext";
import { api } from "@/services/api";
import { agentMeta, formatReceiptDateTime } from "@/utils/payment-receipt";
import { explorerTxUrl, formatUsdc, truncateAddress, type PaidAgent } from "@/constants/payment-constants";
import { transactionPaymentModeLabel, type PaymentTransaction } from "@/types/payment-user";
import { AGENT_COLORS } from "@/components/mission-control/agent-colors";
import { cn } from "@/utils/utils";

const AGENT_LABELS: Record<string, string> = {
  reddit: "Reddit Agent",
  twitter: "X Agent",
  linkedin: "LinkedIn Agent",
  articles: "Articles Agent",
  hackernews: "Hacker News Agent",
  brand_voice: "Brand Voice",
  competitors: "Competitors",
};

const TX_AGENT_COLORS: Record<string, string> = {
  reddit: AGENT_COLORS.reddit,
  twitter: AGENT_COLORS.x,
  linkedin: AGENT_COLORS.linkedin,
  articles: AGENT_COLORS.articles,
  hackernews: AGENT_COLORS.hn,
  brand_voice: AGENT_COLORS.seo,
  competitors: AGENT_COLORS.seo,
};

const AGENT_STYLES: Record<string, { bg: string; text: string; Icon: typeof FileText }> = {
  reddit: { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", Icon: MessageCircle },
  twitter: { bg: "bg-sky-500/15", text: "text-sky-700 dark:text-sky-300", Icon: Twitter },
  linkedin: { bg: "bg-blue-600/15", text: "text-blue-700 dark:text-blue-300", Icon: Linkedin },
  articles: { bg: "bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", Icon: FileText },
  hackernews: { bg: "bg-amber-500/15", text: "text-amber-800 dark:text-amber-300", Icon: Newspaper },
  brand_voice: { bg: "bg-rose-500/15", text: "text-rose-700 dark:text-rose-300", Icon: FileText },
  competitors: { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", Icon: FileText },
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const MAX_PAGE_SIZE = 100;

const txCache = new Map<string, PaymentTransaction[]>();
const STATS_FETCH_LIMIT = 100;

async function fetchAllTransactions(userId: string): Promise<PaymentTransaction[]> {
  const all: PaymentTransaction[] = [];
  let offset = 0;

  while (true) {
    const batch = await api.listTransactions(userId, { limit: STATS_FETCH_LIMIT, offset });
    all.push(...batch);
    if (batch.length < STATS_FETCH_LIMIT) break;
    offset += STATS_FETCH_LIMIT;
  }

  return all;
}

function cacheKey(userId: string, agentFilter: string, page: number, pageSize: number): string {
  return `${userId}:${agentFilter}:${page}:${pageSize}`;
}

function statusBadgeClass(status: string): string {
  if (status === "confirmed") {
    return "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "pending") {
    return "border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }
  return "border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
}

function TransactionSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn("flex h-[60px] items-center gap-4 px-1", i % 2 === 1 && "bg-muted/20")}>
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-56 animate-pulse rounded bg-muted/70" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TransactionsSection() {
  const { walletAddress, userId, sessionReady } = useSession();
  const { user } = usePaymentUser();
  const [rows, setRows] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);
  const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [receiptTx, setReceiptTx] = useState<PaymentTransaction | null>(null);
  const hasShownData = useRef(false);

  const paymentUserId = user?.id ?? userId;

  useEffect(() => {
    if (!sessionReady || !walletAddress || !paymentUserId) return;
    if (paymentUserId.startsWith("local-")) {
      setTotalSpent(0);
      setTotalCount(0);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);

    void fetchAllTransactions(paymentUserId)
      .then((all) => {
        if (cancelled) return;
        const confirmed = all.filter((tx) => tx.status === "confirmed");
        setTotalCount(confirmed.length);
        setTotalSpent(
          confirmed.reduce((sum, tx) => sum + Number(tx.amount_usdc), 0),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTotalSpent(0);
          setTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paymentUserId, sessionReady, walletAddress]);

  useEffect(() => {
    if (!sessionReady || !walletAddress || !paymentUserId) return;
    if (paymentUserId.startsWith("local-")) {
      setRows([]);
      setLoading(false);
      return;
    }

    const key = cacheKey(paymentUserId, agentFilter, page, safePageSize);
    const cached = txCache.get(key);
    if (cached) {
      setRows(cached);
      hasShownData.current = true;
    } else if (!hasShownData.current) {
      setLoading(true);
    }

    let cancelled = false;

    void api
      .listTransactions(paymentUserId, {
        agent: agentFilter === "all" ? undefined : agentFilter,
        limit: safePageSize,
        offset: page * safePageSize,
      })
      .then((data) => {
        if (cancelled) return;
        txCache.set(key, data);
        setRows(data);
        hasShownData.current = true;
      })
      .catch(() => {
        if (cancelled) return;
        if (!cached) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paymentUserId, agentFilter, page, safePageSize, sessionReady, walletAddress]);

  const agents = useMemo(() => Object.keys(AGENT_LABELS) as PaidAgent[], []);

  const totalPages = useMemo(() => {
    if (agentFilter === "all") {
      return Math.max(1, Math.ceil(totalCount / safePageSize));
    }
    if (rows.length < safePageSize) return page + 1;
    return page + 2;
  }, [agentFilter, page, safePageSize, rows.length, totalCount]);

  const txCountLabel =
    totalCount === 1 ? "1 transaction" : `${totalCount} transactions`;

  if (!walletAddress) {
    return <p className="text-sm text-muted-foreground">Sign in to view transaction history.</p>;
  }

  const showSkeleton = loading && rows.length === 0;

  return (
    <div className="space-y-6">
      <header className="mc-settings-page-header">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-display text-2xl font-bold">Transaction History</h2>
          {!statsLoading && totalCount > 0 ? (
            <span className="text-[13px] text-muted-foreground">{txCountLabel}</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          On-chain agent payments with x402 receipts and explorer links.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Total spent"
          value={statsLoading ? "…" : `${formatUsdc(totalSpent)} USDC`}
          loading={statsLoading}
        />
        <StatCard
          label="Total transactions"
          value={statsLoading ? "…" : txCountLabel}
          loading={statsLoading}
        />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Filter by agent
        </p>
        <div className="flex flex-wrap gap-2">
          <FilterPill
            active={agentFilter === "all"}
            onClick={() => {
              setAgentFilter("all");
              setPage(0);
            }}
          >
            All agents
          </FilterPill>
          {agents.map((a) => (
            <FilterPill
              key={a}
              active={agentFilter === a}
              onClick={() => {
                setAgentFilter(a);
                setPage(0);
              }}
            >
              {AGENT_LABELS[a]}
            </FilterPill>
          ))}
          {loading && rows.length > 0 ? (
            <Loader2 className="ml-1 h-4 w-4 animate-spin self-center text-muted-foreground" />
          ) : null}
        </div>
      </div>

      {showSkeleton ? (
        <TransactionSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <ArrowDownLeft className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="font-display font-semibold">No transactions yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run a paid agent from the dashboard to see receipts here.
          </p>
        </div>
      ) : (
        <div>
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] gap-4 px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground sm:grid">
            <span>Agent</span>
            <span>Transaction</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((tx, index) => {
              const meta = agentMeta(tx.agent);
              const style = AGENT_STYLES[tx.agent] ?? AGENT_STYLES.articles;
              const Icon = style.Icon;
              const agentColor = TX_AGENT_COLORS[tx.agent] ?? AGENT_COLORS.articles;

              return (
                <div
                  key={tx.id}
                  className={cn(
                    "grid min-h-[60px] gap-3 px-1 py-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4",
                    index % 2 === 1 && "bg-muted/20",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: agentColor }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-sm font-bold">{meta.title}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em]",
                            statusBadgeClass(tx.status),
                          )}
                        >
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatReceiptDateTime(tx.created_at)} · {transactionPaymentModeLabel(tx.payment_mode)}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    {tx.tx_hash && !tx.tx_hash.startsWith("batch-") ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="font-mono text-xs text-foreground">{truncateAddress(tx.tx_hash)}</code>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(tx.tx_hash);
                            toast.success("Transaction hash copied");
                          }}
                          className="text-muted-foreground transition hover:text-foreground"
                          title="Copy hash"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        {explorerTxUrl(tx.tx_hash) && (
                          <a
                            href={explorerTxUrl(tx.tx_hash)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary transition hover:opacity-80"
                            title="View on Lora"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {tx.from_address && (
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        From {truncateAddress(tx.from_address)}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-display text-base font-bold tabular-nums">{formatUsdc(tx.amount_usdc)}</p>
                    <p className="text-[11px] text-muted-foreground">USDC</p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setReceiptTx(tx)}
                      className="mc-btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      Receipt
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={page === 0 || loading}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="mc-btn-secondary inline-flex h-9 items-center gap-1 px-3 text-sm disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                setPage(0);
              }}
              className="h-8 rounded-lg border border-border bg-secondary px-2 text-xs text-foreground"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} per page
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          disabled={rows.length < safePageSize || loading}
          onClick={() => setPage((p) => p + 1)}
          className="mc-btn-secondary inline-flex h-9 items-center gap-1 px-3 text-sm disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {receiptTx && (
        <PaymentReceiptModal
          tx={receiptTx}
          walletAddress={user?.wallet_address ?? walletAddress ?? ""}
          onClose={() => setReceiptTx(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-secondary px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold", loading && "text-muted-foreground")}>{value}</p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center rounded-full px-3.5 text-xs font-medium transition",
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
