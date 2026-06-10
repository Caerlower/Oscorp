import { AGENT_COLORS } from "@/components/mission-control/agent-colors";

export function agentAccentForDetailId(detailId: string): string {
  if (detailId.includes("x-post") || detailId.includes("twitter")) return AGENT_COLORS.x;
  if (detailId.includes("reddit")) return AGENT_COLORS.reddit;
  if (detailId.includes("linkedin")) return AGENT_COLORS.linkedin;
  if (detailId.includes("articles")) return AGENT_COLORS.articles;
  if (detailId.includes("hn-post") || detailId.includes("hackernews")) return AGENT_COLORS.hn;
  if (detailId.includes("seo")) return AGENT_COLORS.seo;
  return "var(--primary)";
}
