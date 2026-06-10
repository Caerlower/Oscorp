import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  FileText,
  Folder,
  Info,
  Linkedin,
  Lock,
  Minus,
  Newspaper,
  Paperclip,
  Search,
  Send,
  Settings2,
  Twitter,
  X,
} from "lucide-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useDashboardDetail } from "@/components/dashboard/detail-context";
import { useTheme } from "@/context/ThemeContext";
import { scoreColor, vitalLabel, vitalOk } from "@/types/analysis-types";
import { cn } from "@/utils/utils";

export const COMPANY_MINIMIZED_KEY = "oscorp_company_minimized";

export const COMPANY_RAIL_WIDTH_PX = 52;

function PanelSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 rounded-md bg-muted" style={{ width: `${Math.max(40, 95 - i * 12)}%` }} />
      ))}
    </div>
  );
}

function ScoreSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-2 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div className="h-14 w-14 rounded-full bg-muted" />
          <div className="h-2 w-12 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function CompanyCollapseIcon({ expanded }: { expanded: boolean }) {
  return (
    <ChevronRight
      aria-hidden
      className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
    />
  );
}

function competitorUrl(raw: string): string {
  const trimmed = raw.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return trimmed ? `https://${trimmed}` : "#";
}

function Panel({
  title,
  dot,
  action,
  panelId,
  children,
}: {
  title: React.ReactNode;
  dot?: boolean;
  action?: React.ReactNode;
  panelId?: string;
  children: React.ReactNode;
}) {
  const { isOscorp } = useTheme();

  return (
    <div className="dashboard-panel flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-300">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {isOscorp && panelId && <span className="oscorp-panel-id">{panelId}</span>}
          {title}
          {dot && <span className="oscorp-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">{action}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}

function DocRow({
  name,
  badge,
  dot,
  detailId,
  count,
  embedded,
}: {
  name: string;
  badge?: string;
  dot?: boolean;
  detailId?: string;
  count?: number;
  embedded?: boolean;
}) {
  const { openDetail } = useDashboardDetail();
  const { isOscorp } = useTheme();

  if (embedded) {
    return (
      <button
        type="button"
        onClick={() => detailId && openDetail(detailId)}
        className="mc-company-doc-row group flex h-11 w-full items-center gap-2 border-b border-border px-1 text-sm transition hover:bg-muted/50"
      >
        <span className="h-2 w-2 shrink-0 rounded-sm bg-primary" aria-hidden />
        <span className="shrink-0 text-foreground">{name}</span>
        {dot && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="New" />}
        <span className="min-w-[1rem] flex-1 border-b border-dotted border-border" aria-hidden />
        <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-muted-foreground opacity-60 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => detailId && openDetail(detailId)}
      className={`mc-doc-row group flex w-full items-center gap-2 px-1 py-2 text-sm transition hover:opacity-80 ${isOscorp ? "oscorp-doc-row" : "rounded-lg hover:bg-muted"}`}
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="shrink-0">{name}</span>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />}
      {typeof count === "number" && count > 0 && (
        <span className="shrink-0 rounded-lg bg-muted px-1.5 py-0.5 text-[10px] font-medium">{count}</span>
      )}
      <span className="min-w-[1rem] flex-1 border-b border-dotted border-border" aria-hidden />
      {badge ? (
        <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          {badge}
        </span>
      ) : null}
      <ChevronDown className="h-3.5 w-3.5 shrink-0 -rotate-90 text-muted-foreground" />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { isOscorp } = useTheme();

  return (
    <div className="mt-4">
      <div className={`mb-2 ${isOscorp ? "oscorp-section-label" : "text-[11px] uppercase tracking-wider text-muted-foreground"}`}>
        {isOscorp ? title.replace("MOBILE", "Mobile scan").replace("DESKTOP", "Desktop scan") : title}
      </div>
      {children}
    </div>
  );
}

function ScoreRow({ scores, animateIn }: { scores: { v: number; label: string; color: "emerald" | "amber" }[]; animateIn?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {scores.map((s) => (
        <div key={s.label} className="flex flex-col items-center text-center">
          <Ring value={animateIn ? s.v : 0} color={s.color} />
          <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function Ring({ value, color, large }: { value: number; color: "emerald" | "amber"; large?: boolean }) {
  const { isOscorp } = useTheme();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setDisplay(value), 80);
    return () => window.clearTimeout(t);
  }, [value]);
  const stroke =
    color === "emerald"
      ? isOscorp
        ? "oklch(0.52 0.17 155)"
        : "#10b981"
      : isOscorp
        ? "oklch(0.72 0.14 75)"
        : "#f59e0b";
  const r = large ? 28 : 22;
  const size = large ? "h-[72px] w-[72px]" : "h-14 w-14";
  const c = 2 * Math.PI * r;
  const off = c - (display / 100) * c;
  return (
    <div className={`relative ${size}`}>
      <svg viewBox="0 0 64 64" className={`${size} -rotate-90`}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="4" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold" style={{ color: stroke }}>{display}</div>
    </div>
  );
}

function MetricCard({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  const { isOscorp } = useTheme();

  return (
    <div className={`rounded-xl border p-3 ${isOscorp ? "oscorp-metric-card" : "border-border bg-background"}`}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${ok !== false ? "bg-emerald-500" : "bg-amber-500"}`} />
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${ok !== false ? "text-emerald-600" : "text-amber-600"}`}>{value}</div>
    </div>
  );
}

function VitalMetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "pass" | "warn" | "fail";
}) {
  const { isOscorp } = useTheme();
  const ok = vitalOk(status);
  const statusText = vitalLabel(status);

  return (
    <div className={`rounded-xl border p-3 ${isOscorp ? "oscorp-metric-card" : "border-border bg-background"}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : status === "fail" ? "bg-red-500" : "bg-amber-500"}`} />
          {label}
        </span>
        <span className={ok ? "text-emerald-600" : status === "fail" ? "text-red-600" : "text-amber-600"}>{statusText}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold ${ok ? "text-emerald-600" : status === "fail" ? "text-red-600" : "text-amber-600"}`}>
        {value}
      </div>
    </div>
  );
}

function TimingMetricCard({
  label,
  value,
  status,
  valueTone,
}: {
  label: string;
  value: string;
  status?: "pass" | "warn" | "fail" | string;
  valueTone?: "default" | "blocking";
}) {
  const normalized = status === "pass" || status === "warn" || status === "fail" ? status : status ? "warn" : "pass";
  const ok = vitalOk(normalized);
  const numeric = Number.parseFloat(value);
  const blockingBad = valueTone === "blocking" && Number.isFinite(numeric) && numeric > 0;
  const dotClass = blockingBad
    ? "bg-destructive"
    : ok
      ? "bg-primary"
      : normalized === "fail"
        ? "bg-destructive"
        : "bg-amber-500";
  const valueClass = blockingBad
    ? "text-destructive"
    : ok
      ? "text-primary"
      : normalized === "fail"
        ? "text-destructive"
        : "text-amber-600";

  return (
    <div className="rounded-[10px] border border-border bg-secondary p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      </div>
      <div className={`mt-1 font-display text-[22px] font-bold leading-none ${valueClass}`}>{value}</div>
    </div>
  );
}

function HealthStatusIcon({ status }: { status: "pass" | "warn" | "fail" }) {
  if (status === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
  if (status === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
}

function RelevanceBar({ label, value }: { label: string; value: number }) {
  const fillClass =
    value >= 70 ? "bg-primary" : value >= 30 ? "bg-amber-500" : "bg-destructive";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[13px] text-foreground">{label}</span>
        <span className="text-[13px] font-bold text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-[3px] bg-border">
        <div className={`h-full rounded-[3px] ${fillClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function AgentCard({
  id: _id,
  icon,
  name,
  status,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  name: string;
  status: string;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const { isOscorp } = useTheme();

  return (
    <div className={`rounded-xl border ${isOscorp ? "oscorp-agent-card" : "border-border bg-background dark:bg-card"}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/30">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground">{name}</div>
          <div className="truncate text-sm">{status}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && children && (
        <div className="space-y-3 border-t border-border bg-muted/30 p-3">{children}</div>
      )}
    </div>
  );
}

function AgentFeedLoading({ label }: { label?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-4 text-center text-xs text-muted-foreground">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500/60 align-middle" />
      <span className="ml-2">{label ?? "Generating…"}</span>
    </div>
  );
}

function AgentFeedError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          Retry
        </button>
      ) : null}
    </div>
  );
}

function SuggestedTweet({
  id,
  text,
  intentUrl,
}: {
  id?: string;
  text: string;
  intentUrl?: string;
}) {
  const { openDetail } = useDashboardDetail();

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mc-section-label mb-2 flex items-center gap-1.5">
        <Twitter className="h-3 w-3" />
        Suggested tweet
      </div>
      <MarkdownContent variant="compact" className="text-[13px] leading-relaxed">
        {text}
      </MarkdownContent>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() =>
            openDetail("agent:x-post", {
              text,
              intentUrl: intentUrl ?? "",
              deliverableId: id ?? "",
            })
          }
          className="mc-btn-primary inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium"
        >
          <Twitter className="h-3.5 w-3.5" /> Post
        </button>
      </div>
    </div>
  );
}

function AgentDraftPreview({
  label,
  preview,
  actionLabel,
  onOpen,
}: {
  label: string;
  preview: string;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mc-section-label mb-2">{label}</div>
      <div className="line-clamp-3 text-[13px] leading-relaxed text-foreground">
        <MarkdownContent variant="compact">{preview}</MarkdownContent>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onOpen}
          className="mc-btn-primary inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export {
  CompanyCollapseIcon,
  Panel,
  PanelSkeleton,
  ScoreSkeleton,
  DocRow,
  Section,
  ScoreRow,
  Ring,
  MetricCard,
  VitalMetricCard,
  TimingMetricCard,
  HealthStatusIcon,
  RelevanceBar,
  AgentCard,
  AgentFeedLoading,
  AgentFeedError,
  SuggestedTweet,
  AgentDraftPreview,
};
