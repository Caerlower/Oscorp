import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  FileText,
  Globe,
  Linkedin,
  MessageCircle,
  Newspaper,
  Search,
  Twitter,
} from "lucide-react";
import type { DetailParams } from "@/components/dashboard/detail-context";
import type { FullAnalysisResult } from "@/types/analysis-types";
import { DOC_MARKDOWN_KEYS } from "@/types/analysis-types";
import { getDocumentMarkdown, type DocumentKey } from "@/utils/edited-documents";

export type DetailStep = {
  title: string;
  description?: string;
  codeBefore?: string;
  codeAfter?: string;
  code?: string;
};

export type DetailContent = {
  title: string;
  icon: LucideIcon;
  pageTag?: string;
  showMarkComplete?: boolean;
  layout?: "default" | "writer";
  overview?: string;
  draftText?: string;
  whyThisWorks?: string;
  steps?: DetailStep[];
  extra?: ReactNode;
  markdown?: string;
  /** When set, document supports edit + download in the detail drawer. */
  editableDocKey?: DocumentKey;
};

type DetailContext = {
  company: string;
  site: string;
};

function docContent(name: string, pageTag: string, overview: string, steps: DetailStep[]): DetailContent {
  return {
    title: name,
    icon: FileText,
    pageTag,
    overview,
    steps,
  };
}

const DOC_TITLES: Record<DocumentKey, string> = {
  productInfo: "Product Information",
  competitorAnalysis: "Competitor Analysis",
  brandVoice: "Brand Voice",
  marketingStrategy: "Marketing Strategy",
  llmsTxt: "llms.txt",
  articles: "Articles",
};

function detailContentToMarkdown(content: DetailContent): string {
  const parts: string[] = [];
  if (content.overview?.trim()) {
    parts.push("## Overview", "", content.overview.trim(), "");
  }
  if (content.steps?.length) {
    parts.push("## Steps", "");
    content.steps.forEach((step, index) => {
      parts.push(`### ${index + 1}. ${step.title}`);
      if (step.description?.trim()) parts.push("", step.description.trim());
      if (step.code?.trim()) parts.push("", "```", step.code.trim(), "```");
      if (step.codeBefore?.trim() || step.codeAfter?.trim()) {
        if (step.codeBefore?.trim()) parts.push("", "Before:", "```", step.codeBefore.trim(), "```");
        if (step.codeAfter?.trim()) parts.push("", "After:", "```", step.codeAfter.trim(), "```");
      }
      parts.push("");
    });
  }
  return parts.join("\n").trim();
}

const DOC_CONTENT: Record<string, (ctx: DetailContext) => DetailContent> = {
  "doc:product-information": ({ company, site }) =>
    docContent(
      "Product Information",
      "Page: Homepage",
      `${company} is an AI-native product. Oscorp synthesizes positioning, SEO signals, and marketing documents from the live site so your team can act without juggling separate research tools.`,
      [
        {
          title: "Core value proposition",
          description:
            "AI CMO that researches competitors, drafts content ideas, and keeps SEO and technical issues in one workspace.",
        },
        {
          title: "Primary audience",
          description: "Early-stage founders and growth leads who need consistent output but cannot hire a full marketing team yet.",
        },
        {
          title: "Key pages crawled",
          description: `Homepage (${site}), docs, and llms.txt were indexed. Product positioning emphasizes speed, transparency, and on-chain payment receipts.`,
        },
        {
          title: "Suggested positioning tags",
          description: "Payment infrastructure · AI agents · Web3 GTM · Developer tools",
        },
      ],
    ),
  "doc:competitor-analysis": () =>
    docContent(
      "Competitor Analysis",
      "Research: Competitors",
      "Oscorp identified five direct and adjacent competitors across AI marketing, crypto payments, and wallet infrastructure. Cross-referencing their messaging surfaces gaps in autonomous execution and verifiable spend.",
      [
        {
          title: "Messaging gap",
          description:
            "Most competitors sell copilots or dashboards. Few combine agent execution with policy-bound budgets and on-chain receipts.",
        },
        {
          title: "Content opportunities",
          description:
            "Comparison posts on “AI CMO vs ChatGPT workflow”, autonomous marketing ops, and transparent research workflows resonate on X and Reddit.",
        },
        {
          title: "SEO angle",
          description: "Target long-tail queries around autonomous marketing agents, site analysis, and AI-generated company docs.",
        },
      ],
    ),
  "doc:brand-voice": ({ company }) =>
    docContent(
      "Brand Voice",
      "Document: Brand",
      `${company} speaks like a sharp operator — confident, plain-spoken, and slightly contrarian. Avoid hype words; lead with outcomes and receipts.`,
      [
        {
          title: "Tone",
          description: "Direct, founder-friendly, technical when needed. Short paragraphs. Bullets for proof points.",
        },
        {
          title: "Do",
          description: "Use specifics (latency, cost, policy limits). Show before/after workflows. Reference real agent actions.",
        },
        {
          title: "Don't",
          description: "Generic “revolutionary Web3” language, emoji spam, or promises of fully autonomous posting without human review.",
        },
      ],
    ),
  "doc:marketing-strategy": ({ company }) =>
    docContent(
      "Marketing Strategy",
      "Plan: Weekly GTM",
      `Weekly growth plan for ${company}: compound SEO fixes, Reddit replies in niche subreddits, and 3–5 X posts derived from research cycles.`,
      [
        {
          title: "Week 1 — Foundation",
          description: "Ship llms.txt, fix render-blocking JS, publish one comparison thread, reply to 2 Reddit threads.",
        },
        {
          title: "Week 2 — Distribution",
          description: "Repurpose top X thread into LinkedIn carousel. Queue Hacker News Show HN when docs are polished.",
        },
        {
          title: "Week 3 — Proof",
          description: "Case study post with before/after SEO metrics and document excerpts from the dashboard.",
        },
      ],
    ),
  "doc:llms-txt": ({ site }) =>
    docContent(
      "llms.txt",
      `Site: ${site.replace(/^https?:\/\//, "")}`,
      "Machine-readable site summary for LLM crawlers. Publishing llms.txt improves visibility in AI answer engines and gives agents structured context.",
      [
        {
          title: "Recommended structure",
          code: `# ${site}\n> AI CMO platform\n\n## Docs\n- /docs/getting-started\n- /docs/analysis\n\n## Contact\n- support@example.com`,
        },
        {
          title: "Deployment",
          description: "Host at /.well-known/llms.txt or /llms.txt. Regenerate after major product changes.",
        },
      ],
    ),
  "doc:articles": () =>
    docContent(
      "Articles",
      "Pipeline: Content",
      "Long-form content pipeline: SEO landing pages, comparison guides, and developer tutorials fed by agent research cycles.",
      [
        {
          title: "Queued topics",
          description:
            "1) How AI CMOs analyze a site end-to-end  2) SEO + technical fixes for startups  3) Human-in-the-loop marketing docs",
        },
        {
          title: "Next draft",
          description: "Outline ready — 1,200 words targeting “autonomous marketing agent” with internal links to docs.",
        },
      ],
    ),
};

export function resolveDetailContent(
  id: string,
  params: DetailParams,
  ctx: DetailContext,
  analysis?: FullAnalysisResult | null,
): DetailContent | null {
  const docKey = DOC_MARKDOWN_KEYS[id];
  if (docKey) {
    const fromAnalysis = analysis?.documents?.[docKey];
    const raw = getDocumentMarkdown(ctx.site, docKey, typeof fromAnalysis === "string" ? fromAnalysis : "");
    const fallback = DOC_CONTENT[id]?.(ctx);
    const title = DOC_TITLES[docKey] ?? docKey;

    return {
      title,
      icon: FileText,
      pageTag: fallback?.pageTag ?? ctx.site.replace(/^https?:\/\//, ""),
      markdown: raw || (fallback ? detailContentToMarkdown(fallback) : ""),
      editableDocKey: docKey,
    };
  }

  const docFactory = DOC_CONTENT[id];
  if (docFactory) return docFactory(ctx);

  switch (id) {
    case "agent:seo-fix-content-ratio":
      return {
        title: "SEO & GEO Recommendations",
        icon: Globe,
        pageTag: "Page: Homepage",
        overview:
          "Render-blocking resources are delaying first paint on mobile. Lighthouse performance scored 64/100 — primarily driven by synchronous JavaScript in the document head and unoptimized CSS delivery. Fixing these issues should improve Core Web Vitals (FCP, LCP) and help both Google rankings and AI crawler access.",
        steps: [
          {
            title: "Defer non-critical JavaScript",
            description: "Move analytics and widget scripts below the fold and add defer so HTML parsing is not blocked.",
            codeBefore: '<script src="/analytics.js"></script>',
            codeAfter: '<script src="/analytics.js" defer></script>',
          },
          {
            title: "Inline critical CSS",
            description: "Extract above-the-fold styles and inline them in <head> to reduce render-blocking CSS requests.",
            code: "<head>\n  <style>/* critical hero + nav */</style>\n  <link rel=\"preload\" href=\"/styles.css\" as=\"style\">\n</head>",
          },
          {
            title: "Increase text-to-code ratio",
            description:
              "Add 150–200 words of descriptive copy on the homepage hero and feature sections. Current HTML-to-text ratio is below recommended thresholds.",
          },
        ],
      };

    case "agent:x-post": {
      const draftText =
        params.text ??
        "most people think blockchain is hard because the tech is complex.\n\nit's not. it's hard because the interfaces are built for engineers, not humans.\n\nthat's why we built Oscorp — an AI CMO that runs analysis pipeline.";
      return {
        title: "X Writer",
        icon: Twitter,
        layout: "writer",
        showMarkComplete: true,
        draftText,
        whyThisWorks: params.reason?.trim()
          ? params.reason
          : "Short lines and a soft product mention match founder-style X posts. Use the Post button to open X intent with your draft pre-filled.",
      };
    }

    case "agent:reddit-reply": {
      const suggested = params.suggestedReply?.trim();
      return {
        title: "Reddit Reply Draft",
        icon: MessageCircle,
        pageTag: params.subreddit ?? "Subreddit opportunity",
        layout: suggested ? "writer" : undefined,
        showMarkComplete: true,
        draftText: suggested,
        overview: params.reason?.trim()
          ? params.reason
          : `Thread in ${params.subreddit ?? "target subreddit"} matches your ICP. Reply helpfully without spamming links.`,
        steps: suggested
          ? undefined
          : [
              {
                title: "Read the thread",
                description: params.thread ?? "Identify the ask — dev UX, GTM stack, or tooling recommendations.",
              },
              {
                title: "Suggested reply",
                description:
                  "Share a concrete workflow (research → draft → human approve → post). No link drop in first comment unless sub allows it.",
              },
              {
                title: "Follow-up",
                description: "Monitor for replies 24h. Upvote helpful counterpoints to stay credible.",
              },
            ],
      };
    }

    case "agent:articles-draft": {
      const content = params.content?.trim();
      if (content) {
        return {
          title: params.title?.trim() || "Article Draft",
          icon: FileText,
          pageTag: "Articles agent",
          layout: "writer",
          showMarkComplete: true,
          draftText: content,
          overview: params.metaDescription?.trim() || "SEO article generated from your company context.",
        };
      }
      return {
        title: "Article Draft",
        icon: FileText,
        pageTag: "Articles agent",
        overview: "Long-form SEO article outline ready. Targets informational queries with internal links to product docs.",
        steps: [
          { title: "Title", description: "How an AI CMO analyzes your marketing site in one pass" },
          { title: "Sections", description: "Problem → Agent wallet → Policy → Receipt trail → Getting started" },
          { title: "Word count", description: "~1,200 words · Medium difficulty keyword" },
        ],
      };
    }

    case "agent:hn-post": {
      const body = params.body?.trim();
      if (body) {
        return {
          title: params.title?.trim() || "Hacker News Post",
          icon: Newspaper,
          pageTag: params.angle?.trim() || "Show HN",
          layout: "writer",
          showMarkComplete: true,
          draftText: `${params.title ?? ""}\n\n${body}`,
          overview: "Copy into Show HN. Keep tone direct and technical — no marketing fluff.",
        };
      }
      return {
        title: "Hacker News Post",
        icon: Newspaper,
        pageTag: "Show HN",
        overview: "Show HN draft focused on technical novelty: agents with budgets, not another chat wrapper.",
        steps: [
          { title: "Title", description: "Show HN: AI CMO terminal with live SEO and company docs" },
          { title: "First comment", description: "Founder story, link to demo, invite technical questions on policy + receipts." },
        ],
      };
    }

    case "agent:linkedin-post": {
      const post = params.post?.trim();
      if (post) {
        return {
          title: "LinkedIn Post",
          icon: Linkedin,
          pageTag: params.hook?.trim() || "LinkedIn agent",
          layout: "writer",
          showMarkComplete: true,
          draftText: post,
          overview: "Copy and paste into LinkedIn. Edit line breaks before publishing.",
        };
      }
      return {
        title: "LinkedIn Post",
        icon: Linkedin,
        pageTag: "LinkedIn agent",
        overview: "Professional tone carousel adapted from top-performing X thread. Emphasize operator efficiency.",
        steps: [
          { title: "Slide 1", description: "Hook — “We replaced our weekly growth standup with an agent wallet.”" },
          { title: "Slides 2–4", description: "Research, drafts, approvals with receipt screenshots." },
          { title: "Slide 5", description: "CTA to waitlist or docs." },
        ],
      };
    }

    case "agent:ugc-video":
      return {
        title: "UGC Video Script",
        icon: Clapperboard,
        pageTag: "UGC agent",
        overview: "30-second vertical script for founder-led UGC. Demonstrates dashboard → run cycle → draft review.",
        steps: [
          { title: "0–3s", description: "Hook on screen: “Our AI CMO paid for its own research.”" },
          { title: "3–20s", description: "Screen recording of terminal + agents feed." },
          { title: "20–30s", description: "Face to camera CTA." },
        ],
      };

    case "analytics:pagespeed-mobile":
      return {
        title: "Mobile PageSpeed Analysis",
        icon: Search,
        pageTag: "Analytics · SEO",
        overview:
          "Mobile performance 64/100 — accessibility 86, best practices 100, SEO 92. Primary regression is render-blocking resources and main-thread work during hydration.",
        steps: [
          { title: "LCP element", description: "Hero image — consider preload and responsive srcset." },
          { title: "TBT", description: "12ms lab TBT is acceptable; field data may differ." },
          { title: "Next action", description: "Open SEO agent fix queue to defer scripts and inline critical CSS." },
        ],
      };

    case "analytics:geo-overview":
      return {
        title: "GEO Visibility Report",
        icon: Globe,
        pageTag: "Analytics · GEO",
        overview:
          "Generative Engine Optimization tracks citations in ChatGPT, Perplexity, and Google AI Overviews. llms.txt and structured docs increase crawlability for answer engines.",
        steps: [
          { title: "llms.txt", description: "Recommended — not yet published at /.well-known/llms.txt" },
          { title: "AI Overviews", description: "Opportunity found for “Algorand developer tools” cluster." },
          { title: "Brand citations", description: "Not yet tracked — connect Search Console for baseline." },
        ],
      };

    default:
      return null;
  }
}

export function detailCopyText(content: DetailContent): string {
  if (content.markdown?.trim()) {
    const parts = [content.title];
    if (content.pageTag) parts.push(content.pageTag);
    parts.push("", content.markdown.trim());
    return parts.join("\n");
  }

  const parts = [content.title];
  if (content.pageTag) parts.push(content.pageTag);
  if (content.overview) parts.push("", content.overview);
  content.steps?.forEach((step, i) => {
    parts.push("", `${i + 1}. ${step.title}`);
    if (step.description) parts.push(step.description);
    if (step.codeBefore) parts.push("Before:", step.codeBefore);
    if (step.codeAfter) parts.push("After:", step.codeAfter);
    if (step.code) parts.push(step.code);
  });
  return parts.join("\n");
}
