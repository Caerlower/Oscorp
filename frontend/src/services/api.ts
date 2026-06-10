import { API_URL } from "@/constants/config";
import { parseJsonResponse, PaymentRequiredError, type PaymentRequiredDetail } from "@/services/http-response";

export { PaymentRequiredError, type PaymentRequiredDetail };

const BACKEND_HINT =
  "Start the Oscorp API: cd Oscorp/backend && uvicorn app.api.main:app --reload --port 8000";

function formatFetchError(path: string, err: unknown): Error {
  if (err instanceof TypeError) {
    const target = API_URL ? `${API_URL}${path}` : path;
    return new Error(
      `Cannot reach Oscorp API (${target}). ${BACKEND_HINT}`,
    );
  }
  if (err instanceof Error && err.message === "Failed to fetch") {
    return new Error(`Cannot reach Oscorp API. ${BACKEND_HINT}`);
  }
  return err instanceof Error ? err : new Error("Request failed");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    throw formatFetchError(path, err);
  }
  return parseJsonResponse<T>(res);
}

export type SessionConnect = {
  user_id: string;
  wallet_address: string;
  agent_address: string;
  policy_signed: boolean;
  agent_funded: boolean;
  usdc_micro: number;
  usdc_opted_in?: boolean;
  algo_micro?: number;
  min_fund_micro_usdc: number;
};

export type AgentStatus = SessionConnect & {
  policy: Record<string, unknown> | null;
  algo_micro: number;
  usdc_opted_in: boolean;
  spend_cap_micro_usdc: number;
};

export const api = {
  connectWallet: (wallet_address: string) =>
    request<SessionConnect>("/api/session/connect", {
      method: "POST",
      body: JSON.stringify({ wallet_address }),
    }),

  getSession: (userId: string) => request<AgentStatus>(`/api/session/${userId}`),

  getPaymentUser: (walletAddress: string) =>
    request<import("@/types/payment-user").PaymentUser>(
      `/api/users/by-wallet/${encodeURIComponent(walletAddress)}`,
    ),

  updatePaymentUser: (
    userId: string,
    patch: Partial<
      Pick<
        import("@/types/payment-user").PaymentUser,
        | "payment_mode"
        | "agent_wallet_address"
        | "agent_wallet_usdc_balance"
        | "batch_budget_usdc"
        | "batch_spent_usdc"
        | "onboarding_completed"
        | "product_site"
      >
    >,
  ) =>
    request<import("@/types/payment-user").PaymentUser>(`/api/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  syncTwitterDeliverables: (
    userId: string,
    body: import("@/types/agent-types").AgentContextPayload & {
      tweetType:
        | "product_insight"
        | "industry_opinion"
        | "engagement_question"
        | "milestone"
        | "trend_response";
    },
  ) =>
    request<{ tweets: import("@/types/agent-types").TweetVariation[]; allPostedToday: boolean }>(
      `/api/deliverables/users/${userId}/twitter/sync`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  markDeliverablePosted: (deliverableId: string, userId: string) =>
    request<import("@/types/agent-types").TweetVariation>(
      `/api/deliverables/${deliverableId}/posted`,
      {
        method: "PATCH",
        headers: { "X-User-Id": userId },
      },
    ),

  getPaidAgentDeliverable: <T>(userId: string, agent: string) =>
    request<{
      agent: string;
      status?: "unlocked" | "needs_load" | "needs_payment";
      unlocked: boolean;
      data: T | null;
    }>(`/api/deliverables/users/${userId}/agents/${agent}`),

  restorePaidAgentDeliverable: <T>(userId: string, agent: string, body: Record<string, unknown>) =>
    request<{ agent: string; unlocked: boolean; data: T }>(
      `/api/deliverables/users/${userId}/agents/${agent}/restore`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  getWalletBalances: (walletAddress: string) =>
    request<{
      wallet_address: string;
      algo_micro: number;
      usdc_micro: number;
      usdc_opted_in: boolean;
      algo: number;
      usdc: number;
    }>(`/api/users/${encodeURIComponent(walletAddress)}/balances`),

  listTransactions: (userId: string, params?: { agent?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.agent) q.set("agent", params.agent);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return request<import("@/types/payment-user").PaymentTransaction[]>(
      `/api/users/${userId}/transactions${qs ? `?${qs}` : ""}`,
    );
  },

  fullAnalysis: (url: string, company_profile?: Record<string, unknown>) =>
    request<import("@/types/analysis-types").FullAnalysisResult>("/api/full-analysis", {
      method: "POST",
      body: JSON.stringify({ url, company_profile: company_profile ?? null }),
    }),

  getWorkspace: (userId: string, siteUrl: string) =>
    request<{
      user_id: string;
      site_url: string;
      analysis: import("@/types/analysis-types").FullAnalysisResult | null;
      company_profile: Record<string, unknown>;
      edited_documents: Record<string, string>;
      chat_active_messages: import("@/utils/chat-context").ChatMessage[];
      chat_archived_sessions: import("@/utils/chat-context").ChatSession[];
      analysis_updated_at?: string | null;
      updated_at?: string | null;
    }>(`/api/workspaces/users/${userId}?site_url=${encodeURIComponent(siteUrl)}`),

  saveWorkspace: (
    userId: string,
    body: {
      site_url: string;
      analysis?: import("@/types/analysis-types").FullAnalysisResult | null;
      company_profile?: Record<string, unknown>;
      edited_documents?: Record<string, string>;
      chat_active_messages?: import("@/utils/chat-context").ChatMessage[];
      chat_archived_sessions?: import("@/utils/chat-context").ChatSession[];
    },
  ) =>
    request<Record<string, unknown>>(`/api/workspaces/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  cmoChat: (body: {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
    site: string;
    company_name: string;
    company_profile: Record<string, unknown>;
    analysis: import("@/types/analysis-types").FullAnalysisResult | null;
  }) =>
    request<{ reply: string }>("/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),

};
