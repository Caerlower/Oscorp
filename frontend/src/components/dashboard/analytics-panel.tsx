import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Info,
  Search,
  X,
} from "lucide-react";
import { useDashboardDetail } from "@/components/dashboard/detail-context";
import { useAnalysis } from "@/context/AnalysisContext";
import { useTheme } from "@/context/ThemeContext";
import { scoreColor, vitalOk } from "@/types/analysis-types";
import {
  HealthStatusIcon,
  MetricCard,
  PanelSkeleton,
  RelevanceBar,
  ScoreRow,
  ScoreSkeleton,
  TimingMetricCard,
} from "@/components/dashboard/shared";
import { WorkspacePanel } from "@/components/mission-control/WorkspacePanel";

type AnalyticsTab = "SEO" | "Links" | "Technical" | "GEO";

const GOOGLE_CONNECT_DISMISSED_KEY = "oscorp_google_connect_dismissed";

const GOOGLE_SERVICES = [
  {
    id: "analytics",
    name: "Google Analytics",
    subtitle: "Traffic & behavior",
    domain: "analytics.google.com",
    preview: "bars" as const,
    chartTint: "from-orange-300/50 via-orange-200/30 to-transparent",
    barColor: "bg-orange-400/70",
  },
  {
    id: "search-console",
    name: "Search Console",
    subtitle: "Search rankings",
    domain: "search.google.com",
    preview: "line" as const,
    chartTint: "from-blue-300/50 via-blue-200/30 to-transparent",
    barColor: "bg-blue-400/70",
  },
];

function GoogleServicesConnect({ isOscorp }: { isOscorp: boolean }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(GOOGLE_CONNECT_DISMISSED_KEY) === "1";
  });

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(GOOGLE_CONNECT_DISMISSED_KEY, "1");
  };

  if (dismissed) return null;

  return (
    <div className="mc-google-banner mb-6 flex items-center justify-between gap-3 border-b border-border pb-4">
      <p className="text-sm text-muted-foreground">
        Connect Google Analytics + Search Console for deeper insights
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {GOOGLE_SERVICES.map((service) => (
          <button key={service.id} type="button" className="mc-btn-secondary px-2.5 py-1 text-[11px]">
            <img
              src={`https://www.google.com/s2/favicons?domain=${service.domain}&sz=32`}
              alt=""
              width={14}
              height={14}
              className="mr-1 inline-block rounded-sm"
            />
            Connect
          </button>
        ))}
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Dismiss Google services"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function AnalyticsPanel() {
  const [tab, setTab] = useState<AnalyticsTab>("SEO");

  useEffect(() => {
    const focusSeo = () => {
      setTab("SEO");
      requestAnimationFrame(() => {
        document.getElementById("mc-seo-health")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("oscorp:focus-seo-report", focusSeo);
    return () => window.removeEventListener("oscorp:focus-seo-report", focusSeo);
  }, []);

  const { isOscorp } = useTheme();
  const { data: analysis, status: analysisStatus, error: analysisError } = useAnalysis();
  const loading = analysisStatus === "loading" && !analysis;
  const groqLimited = analysis?.aiAnalysis?.status === "rate_limited";

  return (
    <WorkspacePanel
      label="Analytics"
      action={
        <div className="mc-tab-pills flex gap-1">
          {(["SEO", "Links", "Technical", "GEO"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide transition ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      {groqLimited && (
        <p className="mc-alert mc-alert-warning mb-4 text-[13px]">
          {analysis?.aiAnalysis?.message ?? analysisError ?? "Groq rate limit — SEO and technical data shown; AI company insights pending."}
        </p>
      )}

      <div className="space-y-6">
        {loading ? (
          <PanelSkeleton rows={10} />
        ) : (
          <>
            {tab === "SEO" && <SeoTabContent />}
            {tab === "Links" && <LinksTabContent />}
            {tab === "Technical" && <TechnicalTabContent />}
            {tab === "GEO" && <GeoTabContent />}
          </>
        )}
      </div>
    </WorkspacePanel>
  );
}

function SeoTabContent() {
  const { openDetail } = useDashboardDetail();
  const { isOscorp } = useTheme();
  const { data: analysis, status: analysisStatus } = useAnalysis();
  const [vitalsDevice, setVitalsDevice] = useState<"desktop" | "mobile">("desktop");

  const mobile = analysis?.seo?.pagespeed?.mobile;
  const desktop = analysis?.seo?.pagespeed?.desktop;
  const health = analysis?.seo?.health;
  const issues = analysis?.seo?.issues ?? [];
  const loading = analysisStatus === "loading" && !analysis;

  const vitals =
    vitalsDevice === "mobile"
      ? analysis?.seo?.coreWebVitals?.mobile
      : analysis?.seo?.coreWebVitals?.desktop;

  const mobileScores = mobile
    ? [
        { v: mobile.performance, label: "Performance", color: scoreColor(mobile.performance) as "emerald" | "amber" },
        { v: mobile.accessibility, label: "Accessibility", color: scoreColor(mobile.accessibility) as "emerald" | "amber" },
        { v: mobile.bestPractices, label: "Best Practices", color: scoreColor(mobile.bestPractices) as "emerald" | "amber" },
        { v: mobile.seo, label: "SEO", color: scoreColor(mobile.seo) as "emerald" | "amber" },
      ]
    : [
        { v: 0, label: "Performance", color: "amber" as const },
        { v: 0, label: "Accessibility", color: "emerald" as const },
        { v: 0, label: "Best Practices", color: "emerald" as const },
        { v: 0, label: "SEO", color: "emerald" as const },
      ];

  const desktopScores = desktop
    ? [
        { v: desktop.performance, label: "Performance", color: scoreColor(desktop.performance) as "emerald" | "amber" },
        { v: desktop.accessibility, label: "Accessibility", color: scoreColor(desktop.accessibility) as "emerald" | "amber" },
        { v: desktop.bestPractices, label: "Best Practices", color: scoreColor(desktop.bestPractices) as "emerald" | "amber" },
        { v: desktop.seo, label: "SEO", color: scoreColor(desktop.seo) as "emerald" | "amber" },
      ]
    : mobileScores;

  const vitalCards = vitals
    ? [
        { k: "LCP", metric: vitals.lcp },
        { k: "FCP", metric: vitals.fcp },
        { k: "TBT", metric: vitals.tbt },
        { k: "CLS", metric: vitals.cls },
      ]
    : [
        { k: "LCP", metric: undefined },
        { k: "FCP", metric: undefined },
        { k: "TBT", metric: undefined },
        { k: "CLS", metric: undefined },
      ];

  const metaLen = health?.metaDescription?.length ?? health?.metaDescription?.value?.length ?? 0;
  const healthRows: { signal: string; value: string; status: "pass" | "warn" | "fail" }[] = health
    ? [
        {
          signal: "Meta Description",
          value: health.metaDescription.present ? `${metaLen} chars` : "Missing",
          status: health.metaDescription.present && metaLen >= 120 && metaLen <= 160 ? "pass" : "warn",
        },
        {
          signal: "Canonical URL",
          value: health.canonicalUrl.present ? health.canonicalUrl.value : "Missing",
          status: health.canonicalUrl.present ? "pass" : "warn",
        },
        {
          signal: "Language",
          value: health.language.present ? health.language.value : "Not set",
          status: health.language.present ? "pass" : "warn",
        },
        {
          signal: "Mobile Friendly",
          value: health.mobileFriendly ? "Yes" : "No",
          status: health.mobileFriendly ? "pass" : "warn",
        },
        {
          signal: "Word Count",
          value: String(health.wordCount),
          status: health.wordCount >= 300 ? "pass" : "warn",
        },
        {
          signal: "Readability",
          value: health.readability,
          status: health.readability === "Easy" ? "pass" : health.readability === "Moderate" ? "warn" : "fail",
        },
      ]
    : [];

  return (
    <>
      {analysis?.analyzedUrl && (
        <p className="mb-3 text-xs text-muted-foreground">
          Analyzed: {analysis.analyzedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          {analysis.seo?.lighthouseVersion ? ` · Lighthouse ${analysis.seo.lighthouseVersion}` : ""}
        </p>
      )}

      <GoogleServicesConnect isOscorp={isOscorp} />

      <button
        type="button"
        onClick={() => openDetail("analytics:pagespeed-mobile")}
        className="mc-analytics-section group w-full border-b border-border text-left transition hover:opacity-80"
      >
        <div className="mc-section-label mb-3">PageSpeed Scores</div>
        <div className="mb-3 text-xs text-muted-foreground">Lighthouse scores from Google · click for recommendations</div>
      </button>

      <div className="mc-analytics-section flex flex-wrap gap-8 border-b border-border">
        <div className="min-w-[140px] flex-1">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Mobile</div>
          {loading ? <ScoreSkeleton /> : <ScoreRow scores={mobileScores} animateIn={!!mobile} />}
        </div>
        <div className="min-w-[140px] flex-1">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Desktop</div>
          {loading ? <ScoreSkeleton /> : <ScoreRow scores={desktopScores} animateIn={!!desktop} />}
        </div>
      </div>

      <div className="mc-analytics-section border-b border-border">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="mc-section-label">Core Web Vitals</div>
          <div className="mc-tab-pills flex gap-1">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setVitalsDevice(d)}
                className={`rounded-lg px-2.5 py-1 text-[11px] capitalize transition ${
                  vitalsDevice === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="mc-vitals-strip flex items-center">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 min-w-[5rem] flex-1 animate-pulse bg-muted/40" />
              ))
            : vitalCards.map(({ k, metric }, i) => {
                const ok = vitalOk(metric?.status);
                return (
                  <div key={k} className="flex min-w-0 flex-1 items-center">
                    {i > 0 ? <div className="mc-vitals-divider mx-2 h-10 w-px shrink-0 bg-border" /> : null}
                    <div className="flex min-w-0 flex-1 flex-col items-start px-2 py-1">
                      <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{k}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[28px] font-bold leading-none">{metric?.value ?? "—"}</span>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${ok ? "bg-emerald-500" : metric?.status === "fail" ? "bg-red-500" : "bg-amber-500"}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      {healthRows.length > 0 && (
        <div id="mc-seo-health" className="mc-analytics-section border-b border-border pb-6">
          <div className="mc-section-label mb-4">SEO Health</div>
          {healthRows.map((row, i) => (
            <div
              key={row.signal}
              className={`grid h-[52px] grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-1 ${
                i % 2 === 0 ? "bg-secondary/50" : "bg-transparent"
              }`}
            >
              <span className="text-sm text-foreground">{row.signal}</span>
              <span className="flex items-center justify-end gap-2 text-right text-[13px]">
                <HealthStatusIcon status={row.status} />
                <span
                  className={
                    row.status === "fail"
                      ? "text-destructive"
                      : row.status === "warn"
                        ? "text-amber-600"
                        : "text-primary"
                  }
                >
                  {row.value}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mc-analytics-section">
        <div className="mc-section-label mb-3">Issues</div>
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-7 w-32 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No issues detected</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {issues.map((issue) => (
              <span
                key={issue.message}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-foreground"
              >
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                {issue.message}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function LinksTabContent() {
  const { openDetail } = useDashboardDetail();
  const links = [
    { label: "Internal links", value: "24", status: "Healthy", tone: "healthy" as const },
    { label: "External links", value: "12", status: "Review", tone: "warn" as const },
    { label: "Broken links", value: "0", status: "None found", tone: "muted" as const },
    {
      label: "Redirect chains",
      value: "1",
      status: "Fix queued",
      tone: "warn" as const,
      detailId: "agent:seo-fix-content-ratio",
    },
  ];

  const statusClass = (tone: "healthy" | "warn" | "muted") => {
    if (tone === "healthy") return "text-primary";
    if (tone === "warn") return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <>
      <div className="mc-section-label">Link Profile</div>
      <p className="mt-1 text-xs text-muted-foreground">Internal and external link health</p>
      <div className="mt-4">
        {links.map((row, i) => {
          const RowTag = row.detailId ? "button" : "div";
          return (
            <RowTag
              key={row.label}
              type={row.detailId ? "button" : undefined}
              onClick={() => row.detailId && openDetail(row.detailId)}
              className={`grid h-[52px] w-full grid-cols-[1fr_4rem_1fr] items-center gap-3 border-b border-border px-1 text-left ${
                i % 2 === 0 ? "bg-secondary/50" : "bg-transparent"
              } ${row.detailId ? "transition hover:bg-muted/40" : ""}`}
            >
              <span className="text-sm text-foreground">{row.label}</span>
              <span className="text-center font-display text-base font-bold text-primary">{row.value}</span>
              <span className={`flex items-center justify-end gap-1.5 text-[13px] ${statusClass(row.tone)}`}>
                {row.tone === "warn" && row.status === "Fix queued" ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                ) : null}
                {row.status}
              </span>
            </RowTag>
          );
        })}
      </div>
    </>
  );
}

function TechnicalTabContent() {
  const { openDetail } = useDashboardDetail();
  const { data: analysis, status: analysisStatus } = useAnalysis();
  const tech = analysis?.technical;
  const loading = analysisStatus === "loading" && !analysis;

  const onPageScore = tech?.onPageScore ?? analysis?.seo?.pagespeed?.desktop?.seo ?? 0;
  const server = tech?.server;
  const timing = tech?.serverTiming ?? {};
  const rb = tech?.renderBlocking;
  const relevance = analysis?.contentRelevance ?? {};
  const headings = analysis?.headings;
  const social = analysis?.socialTags ?? {};

  const serverRows = server
    ? [
        { label: "Server", value: server.name },
        { label: "Status", value: server.status ? String(server.status) : "—" },
        { label: "Encoding", value: server.encoding },
        { label: "Page Size", value: server.pageSize },
        { label: "DOM Size", value: server.domSize },
        { label: "Cacheable", value: server.cacheable ? "Yes" : "No" },
      ]
    : [];

  const timingRows = [
    { label: "Time to Interactive", key: "timeToInteractive" },
    { label: "DOM Complete", key: "domComplete" },
    { label: "Connection", key: "connection" },
    { label: "TLS Handshake", key: "tlsHandshake" },
    { label: "TTFB", key: "ttfb" },
    { label: "Download", key: "download" },
  ];

  const relevanceRows = [
    { label: "Title Relevance", key: "titleRelevance" },
    { label: "Description Relevance", key: "descriptionRelevance" },
    { label: "Keyword Relevance", key: "keywordRelevance" },
    { label: "Content Rate", key: "contentRate" },
  ];

  const headingCounts = headings
    ? [
        { label: "H1", count: headings.h1?.length ?? 0 },
        { label: "H2", count: headings.h2?.length ?? 0 },
        { label: "H3", count: headings.h3?.length ?? 0 },
      ]
    : [];

  const ogTags = [
    { key: "og:type", value: social.ogType },
    { key: "og:image", value: social.ogImage },
    { key: "og:title", value: social.ogTitle },
    { key: "og:description", value: social.ogDescription },
  ].filter((t) => t.value);

  const twitterTags = [
    { key: "twitter:card", value: social.twitterCard },
    { key: "twitter:site", value: social.twitterSite },
    { key: "twitter:image", value: social.twitterImage },
  ].filter((t) => t.value);

  const socialTagCount = ogTags.length + twitterTags.length;

  const maxHeading = Math.max(...headingCounts.map((x) => x.count), 1);

  return (
    <>
      <div className="mc-section-label">On-Page Overview</div>
      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div className="flex shrink-0 flex-col items-center">
          {loading ? (
            <div className="h-16 w-16 animate-pulse rounded-full bg-muted" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-primary">
              <span className="font-display text-[28px] font-bold leading-none text-primary">
                {onPageScore || "—"}
              </span>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">On-Page Score</p>
        </div>

        {serverRows.length > 0 && (
          <div className="min-w-[220px] flex-1">
            {serverRows.map((row) => {
              const isStatus = row.label === "Status" && row.value === "200";
              const isCacheable = row.label === "Cacheable" && row.value === "Yes";
              return (
                <div
                  key={row.label}
                  className="flex h-11 items-center justify-between gap-4 border-b border-border"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {row.label}
                  </span>
                  <span
                    className={`text-[13px] ${isStatus || isCacheable ? "text-primary" : "text-foreground"}`}
                  >
                    {loading ? "…" : row.value}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={() => openDetail("agent:seo-fix-content-ratio")}
          className="group w-full text-left transition hover:opacity-80"
        >
          <div className="mc-section-label group-hover:underline">Server Timing</div>
          <p className="mt-1 text-xs text-muted-foreground">Response and load times · click for fix recommendations</p>
        </button>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-[10px] bg-muted" />
              ))
            : timingRows.map(({ label, key }) => {
                const metric = timing[key];
                return (
                  <TimingMetricCard
                    key={key}
                    label={label}
                    value={metric?.value ?? "—"}
                    status={metric?.status}
                  />
                );
              })}
        </div>
      </div>

      <div className="mt-8">
        <div className="mc-section-label">Render Blocking</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <TimingMetricCard
            label="Blocking Scripts"
            value={loading ? "…" : String(rb?.blockingScripts ?? "—")}
            status={(rb?.blockingScripts ?? 0) === 0 ? "pass" : "warn"}
            valueTone="blocking"
          />
          <TimingMetricCard
            label="Blocking Stylesheets"
            value={loading ? "…" : String(rb?.blockingStylesheets ?? "—")}
            status={(rb?.blockingStylesheets ?? 0) === 0 ? "pass" : "warn"}
            valueTone="blocking"
          />
        </div>
      </div>

      {Object.keys(relevance).length > 0 && (
        <div className="mt-8">
          <div className="mc-section-label">Content Relevance</div>
          <p className="mt-1 text-xs text-muted-foreground">How well metadata matches page content</p>
          <div className="mt-4 flex flex-col gap-4">
            {relevanceRows.map(({ label, key }) => {
              const pct = relevance[key] ?? 0;
              return <RelevanceBar key={key} label={label} value={pct} />;
            })}
          </div>
        </div>
      )}

      {headingCounts.length > 0 && (
        <div className="mt-8">
          <div className="mc-section-label">Heading Structure</div>
          <p className="mt-1 text-xs text-muted-foreground">Distribution of heading tags across the page</p>
          <div className="mt-4 space-y-3">
            {headingCounts.map((h) => {
              const fillClass =
                h.label === "H1" ? "bg-primary" : h.label === "H2" ? "bg-primary/70" : "bg-primary/40";
              return (
                <div key={h.label} className="flex items-center gap-3">
                  <span className="w-8 text-[13px] font-bold text-foreground">{h.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-[4px] bg-border">
                    <div
                      className={`h-full rounded-[4px] ${fillClass}`}
                      style={{
                        width: `${Math.min(100, Math.max(h.count > 0 ? 12 : 0, (h.count / maxHeading) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-[13px] text-muted-foreground">{h.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {socialTagCount > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div className="mc-section-label">Social Media Tags</div>
            <span className="rounded-xl bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {socialTagCount} tags
            </span>
          </div>
          <div className="mt-4 space-y-4 text-xs">
            {ogTags.length > 0 && (
              <div>
                <div className="text-xs font-bold text-foreground">Open Graph</div>
                <div className="mt-3 space-y-2.5">
                  {ogTags.map((t) => (
                    <div key={t.key} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <span className="font-mono text-muted-foreground">{t.key}</span>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="text-[12px] text-foreground">{t.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {twitterTags.length > 0 && (
              <div>
                <div className="text-xs font-bold text-foreground">Twitter</div>
                <div className="mt-3 space-y-2.5">
                  {twitterTags.map((t) => (
                    <div key={t.key} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <span className="font-mono text-muted-foreground">{t.key}</span>
                        <span className="mx-1 text-muted-foreground">·</span>
                        <span className="text-[12px] text-foreground">{t.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function GeoTabContent() {
  const { openDetail } = useDashboardDetail();

  const items = [
    { q: "Brand cited in ChatGPT", status: "Not yet tracked", tone: "muted" as const },
    { q: "Google AI Overviews", status: "Opportunity found", tone: "success" as const },
    { q: "llms.txt published", status: "Recommended", tone: "accent" as const, detailId: "doc:llms-txt" },
  ];

  const statusClass = (tone: "success" | "accent" | "muted") => {
    if (tone === "success") return "text-primary";
    if (tone === "accent") return "text-primary";
    return "italic text-muted-foreground";
  };

  return (
    <>
      <button
        type="button"
        onClick={() => openDetail("analytics:geo-overview")}
        className="group w-full text-left transition hover:opacity-80"
      >
        <div className="mc-section-label group-hover:underline">Generative Engine Optimization</div>
        <p className="mt-1 text-xs text-muted-foreground">Visibility in AI search and answer engines · click for report</p>
      </button>
      <div className="mt-4">
        {items.map((item) => {
          const RowTag = item.detailId ? "button" : "div";
          return (
            <RowTag
              key={item.q}
              type={item.detailId ? "button" : undefined}
              onClick={() => item.detailId && openDetail(item.detailId)}
              className={`flex h-14 w-full items-center justify-between gap-4 border-b border-border px-1 text-left ${
                item.detailId ? "transition hover:bg-muted/40" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm text-foreground">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    item.tone === "muted" ? "bg-muted-foreground/40" : "bg-primary"
                  }`}
                />
                <span className="truncate">{item.q}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`text-[13px] ${statusClass(item.tone)}`}>{item.status}</span>
                {item.detailId ? <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /> : null}
              </span>
            </RowTag>
          );
        })}
      </div>
    </>
  );
}

