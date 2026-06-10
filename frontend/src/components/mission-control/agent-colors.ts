export const AGENT_COLORS = {
  reddit: "#FF4500",
  x: "#1DA1F2",
  linkedin: "#0077B5",
  articles: "#7C3AED",
  hn: "#FF6600",
  seo: "#10B981",
  ugc: "#F59E0B",
} as const;

export type AgentColorKey = keyof typeof AGENT_COLORS;
