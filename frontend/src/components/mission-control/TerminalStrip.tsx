import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  terminalBootLines,
  terminalFieldLabels,
  terminalHistoryLines,
} from "@/constants/oscorp-theme";

function siteHost(site: string): string {
  return site.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function utcDateLabel(d = new Date()): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) + " (UTC)";
}

export function TerminalStrip({
  site,
  agentsActive,
  tasksReady,
  lastRunLabel,
}: {
  site: string;
  agentsActive: number;
  tasksReady: number;
  lastRunLabel: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, isOscorp } = useTheme();
  const { status: analysisStatus } = useAnalysis();
  const host = siteHost(site);
  const analysisReady = analysisStatus === "live";
  const fieldLabels = terminalFieldLabels(theme);
  const bootSequence = useMemo(() => terminalBootLines(theme), [theme]);
  const historyLines = useMemo(
    () => terminalHistoryLines(analysisReady, 0, theme),
    [analysisReady, theme],
  );

  useEffect(() => {
    let i = 0;
    setBootLines([]);
    const id = setInterval(() => {
      if (i >= bootSequence.length) {
        clearInterval(id);
        return;
      }
      const line = bootSequence[i];
      if (line) setBootLines((l) => [...l, line.replace("{site}", host)]);
      i++;
    }, 380);
    return () => clearInterval(id);
  }, [host, bootSequence]);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [bootLines, showHistory]);

  const terminalStatus = useMemo(() => {
    if (analysisStatus === "loading") return "RUNNING";
    if (analysisReady) return "LIVE";
    return isOscorp ? "STANDBY" : "READY";
  }, [analysisStatus, analysisReady, isOscorp]);

  return (
    <section
      className={`mc-terminal-strip shrink-0 overflow-hidden border-b border-border font-mono transition-[height] duration-200 ease-out ${
        collapsed ? "h-8" : "h-[110px]"
      } ${isOscorp ? "oscorp-terminal-zone" : "bg-[#0a0a0b] text-neutral-300"}`}
    >
      <div className="flex h-full min-h-0">
        <div className={`min-w-0 flex-1 ${collapsed ? "hidden" : "flex flex-col px-4 py-2"}`}>
          <div ref={ref} className="min-h-0 flex-1 overflow-y-auto text-[12px] leading-5">
            <div className="space-y-0.5 text-neutral-500">
              <div>
                <span className="text-neutral-600">&gt; {fieldLabels.target} :</span> {host}
              </div>
              <div>
                <span className="text-neutral-600">&gt; {fieldLabels.status} :</span>{" "}
                <span
                  className={
                    analysisReady || analysisStatus === "loading" ? "text-emerald-400" : "text-amber-400"
                  }
                >
                  {terminalStatus}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory((h) => !h)}
              className="mt-1 text-left text-neutral-600 transition hover:text-neutral-400"
            >
              &gt; {showHistory ? fieldLabels.hideHistory : fieldLabels.history}
            </button>
            <div className="mt-1 text-neutral-600">--- {utcDateLabel()} ---</div>
            <div className="mt-0.5 space-y-0.5">
              {historyLines.map((l) => (
                <div key={l} className="text-neutral-400">
                  {l}
                </div>
              ))}
              {showHistory &&
                bootLines.map((l, i) => (
                  <div key={`boot-${i}`} className={l.startsWith("✓") ? "text-emerald-400" : "text-neutral-600"}>
                    {l}
                  </div>
                ))}
              <span
                className={`inline-block h-3 w-1.5 animate-pulse align-middle ${isOscorp ? "oscorp-terminal-cursor" : "bg-emerald-400"}`}
              />
            </div>
          </div>
        </div>

        {!collapsed && (
          <div className="flex shrink-0 items-center gap-0 border-l border-white/10 px-4">
            {[
              { label: "Agents Active", value: String(agentsActive) },
              { label: "Tasks Ready", value: String(tasksReady) },
              { label: "Last Run", value: lastRunLabel },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`px-5 text-center ${i > 0 ? "border-l border-white/10" : ""}`}
              >
                <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">{stat.label}</div>
                <div className="mt-0.5 font-display text-2xl font-bold text-neutral-100">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-8 shrink-0 items-center justify-center border-l border-white/10 text-neutral-500 transition hover:bg-white/5 hover:text-neutral-300"
          aria-label={collapsed ? "Expand terminal" : "Collapse terminal"}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
}
