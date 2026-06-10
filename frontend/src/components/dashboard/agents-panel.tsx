import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { useDashboardDetail } from "@/components/dashboard/detail-context";
import { useTheme } from "@/context/ThemeContext";
import { PayAgentButton } from "@/components/dashboard/PayAgentButton";
import { usePaidAgents } from "@/context/PaidAgentsContext";
import { useAgentsFeed } from "@/hooks/useAgentsFeed";
import type { PaidAgent } from "@/constants/payment-constants";
import { agentDisplayName, agentStatusText } from "@/constants/oscorp-theme";
import { AGENT_COLORS } from "@/components/mission-control/agent-colors";
import { AgentDetailModal } from "@/components/mission-control/AgentDetailModal";
import { SeoAgentExpanded } from "@/components/mission-control/SeoAgentExpanded";
import { SeoFixDetailModal } from "@/components/mission-control/SeoFixDetailModal";
import type { SeoIssue } from "@/types/analysis-types";
import { WorkspacePanel } from "@/components/mission-control/WorkspacePanel";
import {
  Clapperboard,
  FileText,
  Linkedin,
  MessageCircle,
  Newspaper,
  RefreshCw,
  Search,
  Settings2,
  Twitter,
} from "lucide-react";
import { useAnalysis } from "@/context/AnalysisContext";
import {
  AgentDraftPreview,
  AgentFeedError,
  AgentFeedLoading,
  SuggestedTweet,
} from "@/components/dashboard/shared";

function statusCount(
  count: number,
  singular: string,
  plural: string,
  empty: string,
): string {
  if (count <= 0) return empty;
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function MissionAgentCard({
  index,
  icon,
  name,
  status,
  color,
  active,
  preview,
  footerAction,
  onOpenModal,
}: {
  index: number;
  icon: ReactNode;
  name: string;
  status: string;
  color: string;
  active: boolean;
  preview: ReactNode;
  footerAction?: ReactNode;
  onOpenModal: () => void;
}) {
  return (
    <div
      className={`mc-agent-card flex min-h-[160px] flex-col rounded-xl border border-border bg-card p-4 ${
        active ? "border-l-[3px]" : "opacity-60"
      }`}
      style={{
        borderLeftColor: active ? color : undefined,
        animationDelay: `${index * 50}ms`,
      }}
    >
      <button type="button" onClick={onOpenModal} className="flex min-h-0 flex-1 flex-col text-left">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: color }}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-sm font-bold uppercase leading-tight">{name}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{status}</div>
          </div>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-hidden text-xs text-muted-foreground">{preview}</div>
      </button>
      {footerAction ? (
        <div className="mt-3 shrink-0 [&_.mc-btn-pay]:h-9 [&_.mc-btn-pay]:py-0 [&_button]:h-9">
          {footerAction}
        </div>
      ) : null}
    </div>
  );
}

type AgentModalId = "reddit" | "seo" | "x" | "articles" | "hn" | "linkedin" | "ugc" | null;

export function AgentsFeedPanel({ company, site }: { company: string; site: string }) {
  const { openDetail } = useDashboardDetail();
  const { theme } = useTheme();
  const { data: analysis, status: analysisStatus } = useAnalysis();
  const feed = useAgentsFeed(company);
  const { isAgentPaid } = usePaidAgents();
  const seoIssues = analysis?.seo?.issues ?? [];
  const seoLoading = analysisStatus === "loading" && !analysis;
  const seoStatusText = seoLoading
    ? agentStatusText("Analyzing site…", theme)
    : seoIssues.length > 0
      ? `${seoIssues.length} recommendation${seoIssues.length === 1 ? "" : "s"} ready`
      : agentStatusText("No issues detected", theme);

  const [modalAgent, setModalAgent] = useState<AgentModalId>(null);
  const [seoFixIssue, setSeoFixIssue] = useState<SeoIssue | null>(null);

  const redditStatus = agentStatusText("Coming soon", theme);

  const twitterStatus = feed.twitter.loading
    ? agentStatusText("Writing tweets…", theme)
    : feed.twitter.error
      ? agentStatusText("Needs retry", theme)
      : agentStatusText(
          (feed.twitter.data?.length ?? 0) > 0
            ? statusCount(feed.twitter.data!.length, "idea ready", "ideas ready", "No tweets yet")
            : feed.twitter.unlocked
              ? "All posted for today — new ideas tomorrow"
              : "No tweets yet",
          theme,
        );

  const linkedInPreview = feed.linkedin.data;
  const articlesPreview = feed.articles.data;
  const hnPreview = feed.hackernews.data?.[0];

  const agentFooter = (
    agent: PaidAgent,
    slice: { loading: boolean; error: string | null; unlocked: boolean; paidForToday: boolean },
    onPay: () => void,
    onView: () => void,
  ) => (
    <PayAgentButton
      agent={agent}
      loading={slice.loading}
      paid={(slice.unlocked || slice.paidForToday) && !slice.error}
      error={slice.error}
      onClick={onPay}
      onView={onView}
      onRetry={onPay}
      className="w-full justify-center"
    />
  );

  const viewFooter = (onClick: () => void) => (
    <button type="button" onClick={onClick} className="mc-btn-secondary h-9 w-full text-xs font-medium">
      View
    </button>
  );

  const modalMeta: Record<
    Exclude<AgentModalId, null>,
    { title: string; color: string; icon: ReactNode; body: ReactNode }
  > = {
    seo: {
      title: agentDisplayName("SEO AGENT", theme),
      color: AGENT_COLORS.seo,
      icon: <Search className="h-4 w-4" />,
      body: (
        <SeoAgentExpanded
          loading={seoLoading}
          issues={seoIssues}
          onFix={(issue) => setSeoFixIssue(issue)}
        />
      ),
    },
    reddit: {
      title: agentDisplayName("REDDIT AGENT", theme),
      color: AGENT_COLORS.reddit,
      icon: <MessageCircle className="h-4 w-4" />,
      body: (
        <p className="text-sm text-muted-foreground">
          Reddit opportunity scanning is coming soon. You will be able to find subreddit threads and draft
          replies matched to your ICP.
        </p>
      ),
    },
    x: {
      title: agentDisplayName("X AGENT", theme),
      color: AGENT_COLORS.x,
      icon: <Twitter className="h-4 w-4" />,
      body: (
        <>
          {feed.twitter.loading && <AgentFeedLoading label="Drafting tweets…" />}
          {feed.twitter.error && (
            <AgentFeedError message={feed.twitter.error} onRetry={() => void feed.refreshTwitter()} />
          )}
          {feed.twitter.data?.map((tweet) => (
            <SuggestedTweet key={tweet.id ?? tweet.text} id={tweet.id} text={tweet.text} intentUrl={tweet.intentUrl} />
          ))}
        </>
      ),
    },
    articles: {
      title: agentDisplayName("ARTICLES AGENT", theme),
      color: AGENT_COLORS.articles,
      icon: <FileText className="h-4 w-4" />,
      body: (
        <>
          {!feed.articles.unlocked && !feed.articles.loading && !feed.articles.error && (
            <PayAgentButton
              agent="articles"
              loading={feed.articles.loading}
              paid={isAgentPaid("articles") || feed.articles.paidForToday}
              onClick={() => void feed.runAgent("articles")}
              onView={() => void feed.runAgent("articles")}
              onRetry={() => void feed.runAgent("articles")}
            />
          )}
          {feed.articles.loading && <AgentFeedLoading />}
          {feed.articles.error && (
            <AgentFeedError message={feed.articles.error} onRetry={() => void feed.runAgent("articles")} />
          )}
          {feed.articles.unlocked && articlesPreview && (
            <AgentDraftPreview
              label="SEO article draft"
              preview={articlesPreview.title}
              actionLabel="Open draft"
              onOpen={() =>
                openDetail("agent:articles-draft", {
                  title: articlesPreview.title,
                  content: articlesPreview.content,
                  metaDescription: articlesPreview.metaDescription,
                  wordCount: String(articlesPreview.wordCount),
                  deliverableId: articlesPreview.id ?? "",
                  agent: "articles",
                })
              }
            />
          )}
        </>
      ),
    },
    hn: {
      title: agentDisplayName("HACKER NEWS AGENT", theme),
      color: AGENT_COLORS.hn,
      icon: <Newspaper className="h-4 w-4" />,
      body: (
        <>
          {!feed.hackernews.unlocked && !feed.hackernews.loading && !feed.hackernews.error && (
            <PayAgentButton
              agent="hackernews"
              loading={feed.hackernews.loading}
              paid={isAgentPaid("hackernews") || feed.hackernews.paidForToday}
              onClick={() => void feed.runAgent("hackernews")}
              onView={() => void feed.runAgent("hackernews")}
              onRetry={() => void feed.runAgent("hackernews")}
            />
          )}
          {feed.hackernews.loading && <AgentFeedLoading />}
          {feed.hackernews.error && (
            <AgentFeedError message={feed.hackernews.error} onRetry={() => void feed.runAgent("hackernews")} />
          )}
          {feed.hackernews.unlocked && hnPreview && (
            <AgentDraftPreview
              label={hnPreview.angle || "Show HN"}
              preview={hnPreview.title}
              actionLabel="Open draft"
              onOpen={() =>
                openDetail("agent:hn-post", {
                  title: hnPreview.title,
                  body: hnPreview.body,
                  angle: hnPreview.angle,
                  deliverableId: hnPreview.id ?? "",
                  agent: "hackernews",
                })
              }
            />
          )}
        </>
      ),
    },
    linkedin: {
      title: agentDisplayName("LINKEDIN AGENT", theme),
      color: AGENT_COLORS.linkedin,
      icon: <Linkedin className="h-4 w-4" />,
      body: (
        <>
          {!feed.linkedin.unlocked && !feed.linkedin.loading && !feed.linkedin.error && (
            <PayAgentButton
              agent="linkedin"
              loading={feed.linkedin.loading}
              paid={isAgentPaid("linkedin") || feed.linkedin.paidForToday}
              onClick={() => void feed.runAgent("linkedin")}
              onView={() => void feed.runAgent("linkedin")}
              onRetry={() => void feed.runAgent("linkedin")}
            />
          )}
          {feed.linkedin.loading && <AgentFeedLoading />}
          {feed.linkedin.error && (
            <AgentFeedError message={feed.linkedin.error} onRetry={() => void feed.runAgent("linkedin")} />
          )}
          {feed.linkedin.unlocked && linkedInPreview && (
            <AgentDraftPreview
              label={linkedInPreview.hook || "LinkedIn post"}
              preview={linkedInPreview.post}
              actionLabel="Open draft"
              onOpen={() =>
                openDetail("agent:linkedin-post", {
                  post: linkedInPreview.post,
                  hook: linkedInPreview.hook,
                  wordCount: String(linkedInPreview.wordCount),
                  deliverableId: linkedInPreview.id ?? "",
                  agent: "linkedin",
                })
              }
            />
          )}
        </>
      ),
    },
    ugc: {
      title: agentDisplayName("UGC VIDEOS AGENT", theme),
      color: AGENT_COLORS.ugc,
      icon: <Clapperboard className="h-4 w-4" />,
      body: <p className="text-sm text-muted-foreground">UGC scripts will ship in a later release.</p>,
    },
  };

  const activeModal = modalAgent ? modalMeta[modalAgent] : null;

  return (
    <WorkspacePanel
      label="Agent Network"
      action={
        <>
          <span className="mc-pulse-dot mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <Link to="/settings" search={{ section: "websites" }} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Settings2 className="h-4 w-4" />
          </Link>
        </>
      }
    >
      <div className="mc-agent-grid grid gap-2">
        <MissionAgentCard
          index={0}
          icon={<MessageCircle className="h-4 w-4" />}
          name={agentDisplayName("REDDIT AGENT", theme)}
          status={redditStatus}
          color={AGENT_COLORS.reddit}
          active={false}
          preview={<span>Reddit opportunities scanning</span>}
          onOpenModal={() => setModalAgent("reddit")}
          footerAction={
            <button
              type="button"
              disabled
              className="mc-btn-secondary h-9 w-full cursor-not-allowed text-xs font-medium opacity-60"
            >
              Coming soon
            </button>
          }
        />

        <MissionAgentCard
          index={1}
          icon={<Search className="h-4 w-4" />}
          name={agentDisplayName("SEO AGENT", theme)}
          status={agentStatusText(seoStatusText, theme)}
          color={AGENT_COLORS.seo}
          active={seoIssues.length > 0}
          preview={
            <span className="line-clamp-3">
              {seoLoading
                ? "Loading SEO issues…"
                : seoIssues[0]?.message ?? "No issues detected from the latest crawl."}
            </span>
          }
          onOpenModal={() => setModalAgent("seo")}
          footerAction={viewFooter(() => setModalAgent("seo"))}
        />

        <MissionAgentCard
          index={2}
          icon={<Twitter className="h-4 w-4" />}
          name={agentDisplayName("X AGENT", theme)}
          status={twitterStatus}
          color={AGENT_COLORS.x}
          active={(feed.twitter.data?.length ?? 0) > 0 || feed.twitter.unlocked}
          preview={
            feed.twitter.data?.[0]?.text ? (
              <span className="line-clamp-3">{feed.twitter.data[0].text}</span>
            ) : (
              <span>No drafts yet</span>
            )
          }
          onOpenModal={() => setModalAgent("x")}
          footerAction={viewFooter(() => setModalAgent("x"))}
        />

        <MissionAgentCard
          index={3}
          icon={<FileText className="h-4 w-4" />}
          name={agentDisplayName("ARTICLES AGENT", theme)}
          status={
            feed.articles.loading
              ? agentStatusText("Writing article…", theme)
              : feed.articles.error
                ? agentStatusText("Needs retry", theme)
                : feed.articles.unlocked
                  ? agentStatusText(articlesPreview ? "1 article ready" : "No article yet", theme)
                  : feed.articles.paidForToday
                    ? agentStatusText("Article ready — tap Load", theme)
                    : agentStatusText("Pay to unlock", theme)
          }
          color={AGENT_COLORS.articles}
          active={feed.articles.unlocked || feed.articles.paidForToday}
          preview={<span className="line-clamp-3">{articlesPreview?.title ?? "SEO article draft"}</span>}
          onOpenModal={() => setModalAgent("articles")}
          footerAction={agentFooter(
            "articles",
            feed.articles,
            () => void feed.runAgent("articles"),
            () => setModalAgent("articles"),
          )}
        />

        <MissionAgentCard
          index={4}
          icon={<Newspaper className="h-4 w-4" />}
          name={agentDisplayName("HACKER NEWS AGENT", theme)}
          status={
            feed.hackernews.loading
              ? agentStatusText("Drafting Show HN…", theme)
              : feed.hackernews.error
                ? agentStatusText("Needs retry", theme)
                : feed.hackernews.unlocked
                  ? agentStatusText(hnPreview ? "1 post ready" : "No post yet", theme)
                  : feed.hackernews.paidForToday
                    ? agentStatusText("Post ready — tap Load", theme)
                    : agentStatusText("Pay to unlock", theme)
          }
          color={AGENT_COLORS.hn}
          active={feed.hackernews.unlocked || feed.hackernews.paidForToday}
          preview={<span className="line-clamp-3">{hnPreview?.title ?? "Show HN draft"}</span>}
          onOpenModal={() => setModalAgent("hn")}
          footerAction={agentFooter(
            "hackernews",
            feed.hackernews,
            () => void feed.runAgent("hackernews"),
            () => setModalAgent("hn"),
          )}
        />

        <MissionAgentCard
          index={5}
          icon={<Linkedin className="h-4 w-4" />}
          name={agentDisplayName("LINKEDIN AGENT", theme)}
          status={
            feed.linkedin.loading
              ? agentStatusText("Writing post…", theme)
              : feed.linkedin.error
                ? agentStatusText("Needs retry", theme)
                : feed.linkedin.unlocked
                  ? agentStatusText(linkedInPreview ? "1 post ready" : "No post yet", theme)
                  : feed.linkedin.paidForToday
                    ? agentStatusText("Post ready — tap Load", theme)
                    : agentStatusText("Pay to unlock", theme)
          }
          color={AGENT_COLORS.linkedin}
          active={feed.linkedin.unlocked || feed.linkedin.paidForToday}
          preview={<span className="line-clamp-3">{linkedInPreview?.post?.slice(0, 120) ?? "LinkedIn post draft"}</span>}
          onOpenModal={() => setModalAgent("linkedin")}
          footerAction={agentFooter(
            "linkedin",
            feed.linkedin,
            () => void feed.runAgent("linkedin"),
            () => setModalAgent("linkedin"),
          )}
        />

        <MissionAgentCard
          index={6}
          icon={<Clapperboard className="h-4 w-4" />}
          name={agentDisplayName("UGC VIDEOS AGENT", theme)}
          status={agentStatusText("Coming soon", theme)}
          color={AGENT_COLORS.ugc}
          active={false}
          preview={<span>UGC scripts coming in a later release</span>}
          onOpenModal={() => setModalAgent("ugc")}
        />
      </div>

      <button
        type="button"
        disabled
        title="Agents refresh on pay"
        className="mc-btn-secondary mt-4 flex w-full items-center justify-center gap-2 py-2.5 text-xs font-medium uppercase tracking-wide opacity-60"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh All Agents
      </button>

      <SeoFixDetailModal
        open={!!seoFixIssue}
        issue={seoFixIssue}
        company={company}
        site={site}
        onClose={() => setSeoFixIssue(null)}
      />

      {activeModal ? (
        <AgentDetailModal
          open
          title={activeModal.title}
          color={activeModal.color}
          icon={activeModal.icon}
          onClose={() => setModalAgent(null)}
        >
          <div className="space-y-3">{activeModal.body}</div>
        </AgentDetailModal>
      ) : null}
    </WorkspacePanel>
  );
}
