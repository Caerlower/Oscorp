import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tint = "bg-grad-lavender",
  status,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tint?: string;
  status?: "ok" | "warn" | "neutral";
}) {
  const statusRing =
    status === "ok"
      ? "ring-emerald-200/80"
      : status === "warn"
        ? "ring-amber-200/80"
        : "ring-border/80";

  return (
    <div className={`surface-card flex gap-4 p-5 ring-1 ${statusRing}`}>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tint}`}
      >
        <Icon className="h-5 w-5 text-foreground/65" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
