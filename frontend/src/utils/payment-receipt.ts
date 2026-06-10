import { IS_ALGORAND_TESTNET, type PaidAgent } from "@/constants/payment-constants";
import type { PaymentTransaction } from "@/types/payment-user";

export type AgentReceiptMeta = {
  title: string;
  description: string;
  sku: string;
  api: string;
};

export const AGENT_RECEIPT_META: Record<string, AgentReceiptMeta> = {
  reddit: {
    title: "Reddit Agent",
    description: "Subreddit opportunities and reply drafts matched to your ICP",
    sku: "oscorp.reddit",
    api: "/api/agents/reddit",
  },
  twitter: {
    title: "X Agent",
    description: "Founder-style tweet variations for your product narrative",
    sku: "oscorp.twitter",
    api: "/api/agents/twitter",
  },
  linkedin: {
    title: "LinkedIn Agent",
    description: "Professional post draft aligned to your brand voice",
    sku: "oscorp.linkedin",
    api: "/api/agents/linkedin",
  },
  articles: {
    title: "Articles Agent",
    description: "SEO article draft generated from your site analysis and keywords",
    sku: "oscorp.articles",
    api: "/api/agents/articles",
  },
  hackernews: {
    title: "Hacker News Agent",
    description: "Show HN post draft with technical positioning for your launch",
    sku: "oscorp.hackernews",
    api: "/api/agents/hackernews",
  },
};

export function receiptShortId(tx: PaymentTransaction): string {
  return tx.id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function receiptNetworkLabel(): string {
  return IS_ALGORAND_TESTNET ? "Algorand TestNet" : "Algorand MainNet";
}

export function formatReceiptDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function agentMeta(agent: string): AgentReceiptMeta {
  return (
    AGENT_RECEIPT_META[agent] ?? {
      title: agent,
      description: "Oscorp agent run",
      sku: `oscorp.${agent}`,
      api: `/api/agents/${agent}`,
    }
  );
}

export type PaidAgentKey = PaidAgent;
