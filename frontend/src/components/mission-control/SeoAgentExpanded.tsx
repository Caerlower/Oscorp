import { Loader2, Search } from "lucide-react";
import type { SeoIssue } from "@/types/analysis-types";
import { cn } from "@/utils/utils";

function severityBadgeClass(severity: string): string {
  const s = severity.toLowerCase();
  if (s.includes("high") || s.includes("fail") || s.includes("error")) {
    return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  if (s.includes("low") || s.includes("info")) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

function mapIssue(issue: SeoIssue) {
  const severity = issue.impact?.trim() || "Medium";
  const category =
    issue.category?.trim() ||
    (issue.type?.trim() && !issue.type.toLowerCase().includes("warning") ? issue.type : "Technical");
  return {
    title: issue.message,
    severity: severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase(),
    category: category.charAt(0).toUpperCase() + category.slice(1).toLowerCase(),
  };
}

export function SeoAgentExpanded({
  loading,
  issues,
  onFix,
}: {
  loading: boolean;
  issues: SeoIssue[];
  onFix: (issue: SeoIssue) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading SEO recommendations…
      </div>
    );
  }

  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">No issues detected from the latest crawl.</p>;
  }

  return (
    <>
      {issues.map((issue, index) => {
        const row = mapIssue(issue);
        return (
          <div key={`${issue.message}-${index}`} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Search className="h-3 w-3" /> SEO recommendation
            </div>
            <p className="text-sm font-medium leading-snug">{row.title}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={cn(
                  "rounded-xl border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  severityBadgeClass(row.severity),
                )}
              >
                {row.severity}
              </span>
              <span className="rounded-xl border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {row.category}
              </span>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => onFix(issue)} className="mc-btn-primary inline-flex h-9 items-center px-3 text-xs font-medium">
                Fix
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
