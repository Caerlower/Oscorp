import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { useCompanyProfile } from "@/context/CompanyProfileContext";
import { usePaymentContext } from "@/context/PaymentContext";
import { usePaymentUser } from "@/hooks/usePaymentUser";
import { api } from "@/services/api";
import { x402Post } from "@/services/x402-api";
import type { X402FetchFn } from "@/hooks/useX402Fetch";
import { PaymentPreflightError } from "@/utils/algorand-wallet";
import { buildAgentContext, technicalDetailsForHn } from "@/utils/agent-context";
import type { PaidAgent } from "@/constants/payment-constants";
import type { HackerNewsPost, RedditOpportunity, TweetVariation } from "@/types/agent-types";

type PaidAgentKey = "reddit" | "linkedin" | "articles" | "hackernews";
type AgentKey = PaidAgentKey | "twitter";
type PaidAgentAccessStatus = "unlocked" | "needs_load" | "needs_payment";

type ArticleData = {
  id?: string;
  title: string;
  slug: string;
  content: string;
  wordCount: number;
  metaDescription: string;
};

type LinkedInData = {
  id?: string;
  post: string;
  wordCount: number;
  hook: string;
};

type AgentSlice<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  unlocked: boolean;
  /** Paid for current slot but content not loaded yet — show Load, not Pay */
  paidForToday: boolean;
};

export type AgentsFeedState = {
  reddit: AgentSlice<RedditOpportunity[]>;
  twitter: AgentSlice<TweetVariation[]>;
  linkedin: AgentSlice<LinkedInData>;
  articles: AgentSlice<ArticleData>;
  hackernews: AgentSlice<HackerNewsPost[]>;
  runAgent: (key: PaidAgentKey) => Promise<void>;
  refreshTwitter: () => Promise<void>;
};

function emptySlice<T>(hydrating = false): AgentSlice<T> {
  return {
    data: null,
    loading: hydrating,
    error: null,
    unlocked: false,
    paidForToday: false,
  };
}

const PAID_AGENT_KEYS: Record<PaidAgentKey, PaidAgent> = {
  reddit: "reddit",
  linkedin: "linkedin",
  articles: "articles",
  hackernews: "hackernews",
};

const PERSISTED_PAID_AGENTS: PaidAgentKey[] = ["articles", "linkedin", "hackernews"];

type PaidSetter = Dispatch<SetStateAction<AgentSlice<unknown>>>;

function paidSetter<K extends PaidAgentKey>(
  setters: Record<PaidAgentKey, PaidSetter>,
  key: K,
): PaidSetter {
  return setters[key];
}

function applyAccessStatus<T>(
  status: PaidAgentAccessStatus,
  data: T | null,
): AgentSlice<T> {
  if (status === "unlocked" && data) {
    return {
      data,
      loading: false,
      error: null,
      unlocked: true,
      paidForToday: false,
    };
  }
  if (status === "needs_load") {
    return {
      data: null,
      loading: false,
      error: null,
      unlocked: false,
      paidForToday: true,
    };
  }
  return {
    data: null,
    loading: false,
    error: null,
    unlocked: false,
    paidForToday: false,
  };
}

export function useAgentsFeed(company: string): AgentsFeedState {
  const { site, data: analysis, status: analysisStatus } = useAnalysis();
  const { profile } = useCompanyProfile();
  const { triggerPayment } = usePaymentContext();
  const { user: paymentUser } = usePaymentUser();
  const [reddit, setReddit] = useState(emptySlice<RedditOpportunity[]>());
  const [twitter, setTwitter] = useState(emptySlice<TweetVariation[]>());
  const [linkedin, setLinkedin] = useState(emptySlice<LinkedInData>(true));
  const [articles, setArticles] = useState(emptySlice<ArticleData>(true));
  const [hackernews, setHackernews] = useState(emptySlice<HackerNewsPost[]>(true));
  const fetchInFlight = useRef<Partial<Record<AgentKey, boolean>>>({});
  const paidAgentsLoadedKey = useRef<string | null>(null);
  const twitterLoadedKey = useRef<string | null>(null);

  const context = useMemo(
    () => buildAgentContext(profile, analysis, company, site),
    [profile, analysis, company, site],
  );

  const contextKey = useMemo(() => JSON.stringify(context), [context]);

  const setters = useMemo(
    () => ({
      reddit: setReddit as PaidSetter,
      twitter: setTwitter as PaidSetter,
      linkedin: setLinkedin as PaidSetter,
      articles: setArticles as PaidSetter,
      hackernews: setHackernews as PaidSetter,
    }),
    [],
  );

  const refreshTwitter = useCallback(async () => {
    if (fetchInFlight.current.twitter) return;
    if (!paymentUser?.id) return;
    fetchInFlight.current.twitter = true;
    setTwitter((s) => ({ ...s, loading: true, error: null }));

    try {
      const { tweets } = await api.syncTwitterDeliverables(paymentUser.id, {
        ...context,
        tweetType: "product_insight",
      });
      setTwitter({
        data: tweets,
        loading: false,
        error: null,
        unlocked: true,
        paidForToday: false,
      });
    } catch (e) {
      setTwitter({
        data: null,
        loading: false,
        error: e instanceof Error ? e.message : "Agent request failed",
        unlocked: false,
        paidForToday: false,
      });
    } finally {
      fetchInFlight.current.twitter = false;
    }
  }, [context, paymentUser?.id]);

  const removeTweet = useCallback((deliverableId: string) => {
    setTwitter((s) => ({
      ...s,
      data: s.data?.filter((tweet) => tweet.id !== deliverableId) ?? null,
    }));
  }, []);

  const resetPaidAgent = useCallback((key: PaidAgentKey) => {
    paidSetter(setters, key)(emptySlice());
  }, [setters]);

  const restoreBody = useCallback(
    (key: PaidAgentKey) => {
      const targetKeyword = context.keywords[0] ?? company.toLowerCase();
      const productUrl = site.startsWith("http") ? site : `https://${site}`;
      const technicalDetails = technicalDetailsForHn(analysis, context.productInfo, productUrl);
      if (key === "articles") {
        return { ...context, articleType: "seo_content" as const, targetKeyword };
      }
      if (key === "linkedin") {
        return { ...context, postType: "lesson_learned" as const };
      }
      if (key === "hackernews") {
        return { ...context, productUrl, technicalDetails };
      }
      return context;
    },
    [analysis, company, context, site],
  );

  const applyPaidData = useCallback(
    (key: PaidAgentKey, data: unknown) => {
      paidSetter(setters, key)(applyAccessStatus("unlocked", data));
    },
    [setters],
  );

  const tryRestorePaidAgent = useCallback(
    async (key: PaidAgentKey): Promise<boolean> => {
      if (!paymentUser?.id || paymentUser.id.startsWith("local-")) return false;
      const restored = await api.restorePaidAgentDeliverable(
        paymentUser.id,
        key,
        restoreBody(key),
      );
      if (restored.unlocked && restored.data) {
        applyPaidData(key, restored.data);
        return true;
      }
      return false;
    },
    [applyPaidData, paymentUser?.id, restoreBody],
  );

  const loadPaidAgent = useCallback(
    async (key: PaidAgentKey) => {
      if (!paymentUser?.id || paymentUser.id.startsWith("local-")) {
        paidSetter(setters, key)(emptySlice());
        return;
      }
      paidSetter(setters, key)((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await api.getPaidAgentDeliverable(paymentUser.id, key);
        const status = res.status ?? (res.unlocked ? "unlocked" : "needs_payment");

        if (status === "unlocked" && res.data) {
          applyPaidData(key, res.data);
          return;
        }

        if (status === "needs_load") {
          paidSetter(setters, key)(applyAccessStatus("needs_load", null));
          return;
        }

        paidSetter(setters, key)(applyAccessStatus("needs_payment", null));
      } catch {
        paidSetter(setters, key)(emptySlice());
      }
    },
    [applyPaidData, paymentUser?.id, setters],
  );

  useEffect(() => {
    if (!paymentUser?.id) {
      paidAgentsLoadedKey.current = null;
      return;
    }
    const loadKey = `${paymentUser.id}:${contextKey}`;
    if (paidAgentsLoadedKey.current === loadKey) return;
    paidAgentsLoadedKey.current = loadKey;
    void Promise.all(PERSISTED_PAID_AGENTS.map((key) => loadPaidAgent(key)));
  }, [paymentUser?.id, contextKey, loadPaidAgent]);

  useEffect(() => {
    if (analysisStatus === "loading" && !analysis) return;
    if (!context.productInfo.trim()) return;
    if (!paymentUser?.id) {
      twitterLoadedKey.current = null;
      return;
    }

    const loadKey = `${paymentUser.id}:${contextKey}`;
    if (twitterLoadedKey.current === loadKey) return;

    const id = window.setTimeout(() => {
      twitterLoadedKey.current = loadKey;
      void refreshTwitter();
    }, 400);

    return () => window.clearTimeout(id);
  }, [contextKey, analysisStatus, analysis, refreshTwitter, context.productInfo, paymentUser?.id]);

  useEffect(() => {
    const onPosted = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; agent?: PaidAgentKey }>).detail;
      const agent = detail?.agent;
      if (agent && (PERSISTED_PAID_AGENTS as readonly string[]).includes(agent)) {
        resetPaidAgent(agent);
        void loadPaidAgent(agent);
        return;
      }
      const id = detail?.id;
      if (id) removeTweet(id);
    };
    window.addEventListener("oscorp:deliverable-posted", onPosted);
    return () => window.removeEventListener("oscorp:deliverable-posted", onPosted);
  }, [loadPaidAgent, removeTweet, resetPaidAgent]);

  const runAgent = useCallback(
    async (key: PaidAgentKey) => {
      if (fetchInFlight.current[key]) return;
      fetchInFlight.current[key] = true;
      const paidAgent = PAID_AGENT_KEYS[key];
      paidSetter(setters, key)((s) => ({ ...s, loading: true, error: null }));

      const targetKeyword = context.keywords[0] ?? company.toLowerCase();
      const productUrl = site.startsWith("http") ? site : `https://${site}`;
      const technicalDetails = technicalDetailsForHn(analysis, context.productInfo, productUrl);

      const runAgentRequest = async (fetch: X402FetchFn) => {
        switch (key) {
          case "reddit":
            return (
              await x402Post<{ opportunities: RedditOpportunity[] }>(
                fetch,
                "/api/agents/reddit",
                context,
                "reddit",
              )
            ).opportunities;
          case "linkedin":
            return x402Post(fetch, "/api/agents/linkedin", { ...context, postType: "lesson_learned" }, "linkedin");
          case "articles":
            return x402Post(
              fetch,
              "/api/agents/articles",
              { ...context, articleType: "seo_content", targetKeyword },
              "articles",
            );
          case "hackernews":
            return (
              await x402Post<{ posts: HackerNewsPost[] }>(
                fetch,
                "/api/agents/hackernews",
                { ...context, productUrl, technicalDetails },
                "hackernews",
              )
            ).posts;
          default:
            throw new Error("Unknown agent");
        }
      };

      try {
        if (paymentUser?.id && !paymentUser.id.startsWith("local-")) {
          const access = await api.getPaidAgentDeliverable(paymentUser.id, key);
          const status = access.status ?? (access.unlocked ? "unlocked" : "needs_payment");

          if (status === "unlocked" && access.data) {
            applyPaidData(key, access.data);
            return;
          }

          if (status === "needs_load") {
            const restored = await tryRestorePaidAgent(key);
            if (restored) return;
            paidSetter(setters, key)({
              data: null,
              loading: false,
              error: "Could not load your content. Tap Retry.",
              unlocked: false,
              paidForToday: true,
            });
            return;
          }
        }

        const data = await triggerPayment(paidAgent, (fetch) => runAgentRequest(fetch));

        if (paymentUser?.id && !paymentUser.id.startsWith("local-")) {
          try {
            const saved = await api.getPaidAgentDeliverable(paymentUser.id, key);
            if (saved.unlocked && saved.data) {
              applyPaidData(key, saved.data);
              return;
            }
          } catch {
            /* backend may have persisted already */
          }
        }

        applyPaidData(key, data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Agent request failed";
        if (msg === "BATCH_EXHAUSTED" || e instanceof PaymentPreflightError) {
          paidSetter(setters, key)((s) => ({ ...s, loading: false, error: null }));
        } else if (msg.toLowerCase().includes("cancel")) {
          paidSetter(setters, key)((s) => ({ ...s, loading: false, error: null }));
        } else {
          paidSetter(setters, key)({
            data: null,
            loading: false,
            error: msg,
            unlocked: false,
            paidForToday: false,
          });
        }
      } finally {
        fetchInFlight.current[key] = false;
      }
    },
    [
      analysis,
      applyPaidData,
      company,
      context,
      paymentUser?.id,
      setters,
      site,
      triggerPayment,
      tryRestorePaidAgent,
    ],
  );

  return {
    reddit,
    twitter,
    linkedin,
    articles,
    hackernews,
    runAgent,
    refreshTwitter,
  };
}
