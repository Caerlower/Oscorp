export type AgentContextPayload = {
  productInfo: string;
  brandVoice: string;
  marketingStrategy: string;
  competitors: string[];
  keywords: string[];
};

export type RedditOpportunity = {
  title: string;
  subreddit: string;
  upvotes: number;
  comments: number;
  url: string;
  score: number;
  reason: string;
  suggestedReply: string;
};

export type TweetVariation = {
  id?: string;
  text: string;
  characterCount: number;
  intentUrl: string;
  status?: "pending" | "posted";
  slotIndex?: number;
};

export type HackerNewsPost = {
  id?: string;
  title: string;
  body: string;
  angle: string;
  wordCount: number;
};
