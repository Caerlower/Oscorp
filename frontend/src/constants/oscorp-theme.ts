import type { AppTheme } from "@/context/ThemeContext";

export const OSCORP_ACTIVATION_TOAST = {
  title: "🧪 Oscorp Labs Activated",
  description: "Experimental marketing intelligence online.",
} as const;

export function terminalStatusLabel(canRun: boolean, theme: AppTheme): string {
  if (theme === "oscorp") {
    return canRun ? "Oscorp Intelligence Active" : "Systems Initializing";
  }
  return canRun ? "Running Daily" : "Setup needed";
}

export function terminalMetaStatus(canRun: boolean, theme: AppTheme): string {
  if (theme === "oscorp") {
    return canRun ? "OPERATIONAL" : "INITIALIZING";
  }
  return canRun ? "COMPLETED" : "SETUP NEEDED";
}

export function terminalBootLines(theme: AppTheme): string[] {
  if (theme === "oscorp") {
    return [
      "> Initializing Oscorp Intelligence for {site}…",
      "> Calibrating brand extraction models…",
      "> Indexing competitive intelligence graph…",
      "> Activating neural marketing protocols…",
      "✓ Oscorp Labs online.",
    ];
  }
  return [
    "> Initializing AI CMO for {site}...",
    "> Crawling website and extracting brand voice...",
    "> Product document reviewed.",
    "> Relevant product context has been extracted.",
    "✓ Done!",
  ];
}

export function terminalFieldLabels(theme: AppTheme) {
  if (theme === "oscorp") {
    return {
      target: "SUBJECT",
      status: "SYSTEM",
      plan: "BILLING",
      role: "OPERATOR",
      history: "Archive research log",
      hideHistory: "Collapse archive",
    };
  }
  return {
    target: "TARGET",
    status: "STATUS",
    plan: "PLAN",
    role: "ROLE",
    history: "Load older history",
    hideHistory: "Hide older history",
  };
}

export function terminalHistoryLines(
  canRun: boolean,
  draftCount: number,
  theme: AppTheme,
): string[] {
  if (theme === "oscorp") {
    return [
      `llms.txt indexed (${120 + draftCount * 11} tokens, ${2 + draftCount} URLs)`,
      "> Consulting Oscorp Intelligence…",
      "> Analyzing competitive landscape…",
      canRun
        ? "> Generating strategic recommendations…"
        : "> Run site analysis to activate research protocols",
    ];
  }
  return [
    `llms.txt ready (${120 + draftCount * 11} tokens, ${2 + draftCount} URLs)`,
    "> Fetching analytics and agent feed...",
    "> Loading documents and initializing AI Chat...",
    canRun ? "> AI CMO is synthesizing recommendations…" : "> Run analysis to populate documents",
  ];
}

export function chatPlaceholder(theme: AppTheme): string {
  if (theme === "oscorp") return "Consult Oscorp Intelligence…";
  return "Ask me anything…";
}

export function companyPanelTitle(theme: AppTheme): string {
  if (theme === "oscorp") return "Research Subject";
  return "Company";
}

export function documentsSectionLabel(theme: AppTheme): string {
  if (theme === "oscorp") return "Intelligence corpus";
  return "Documents";
}

export function competitorsSectionLabel(theme: AppTheme): string {
  if (theme === "oscorp") return "Competitive landscape";
  return "Competitors";
}

export function agentStatusText(status: string, theme: AppTheme): string {
  if (theme !== "oscorp") return status;
  const map: Record<string, string> = {
    "2 opportunities ready": "2 signals detected · ready for deployment",
    "2 recommendations ready; SEO fixes queued": "2 optimization vectors · fixes queued",
    "1 topic ready": "1 narrative vector · ready",
    "1 post ready": "1 draft synthesized · ready",
    "1 video ready": "1 asset rendered · ready",
  };
  if (map[status]) return map[status];
  if (/^\d+ idea/.test(status)) {
    return status.replace("ready", "synthesized · ready for review");
  }
  return status;
}

export function agentDisplayName(name: string, theme: AppTheme): string {
  if (theme !== "oscorp") return name;
  return name.replace(" AGENT", " · Lab Unit");
}

