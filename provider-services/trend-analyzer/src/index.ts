import { startPaidProvider } from "../../lib/createPaidApp.js";

startPaidProvider({
  port: Number(process.env.PORT ?? 8101),
  serviceName: "trend-analyzer",
  routeKey: "POST /analyze-trends",
  price: "$0.01",
  description: "Trend analysis for X growth",
  registerRoutes: (app) => {
    app.post("/analyze-trends", async (c) => {
      const body = await c.req.json<{
        niche: string;
        recent_posts?: string[];
        x_research?: {
          trending_topics?: string[];
          suggested_angles?: string[];
          top_topic?: string;
        };
      }>();
      const xr = body.x_research;
      const defaultTopics = [
        `${body.niche} distribution`,
        "AI agents replacing SaaS workflows",
        "founder-led growth on X",
        "building in public lessons",
      ];
      const topics =
        xr?.trending_topics?.length ? xr.trending_topics : defaultTopics;
      const postCount = body.recent_posts?.length ?? 0;
      if (!xr?.trending_topics?.length && topics.length > 1) {
        const rotated = [
          ...topics.slice(postCount % topics.length),
          ...topics.slice(0, postCount % topics.length),
        ];
        topics.splice(0, topics.length, ...rotated);
      }
      const angles =
        xr?.suggested_angles?.length
          ? xr.suggested_angles
          : ["Post outcomes, not feature lists", "Use contrarian founder takes"];
      return c.json({
        provider: "trend-analyzer",
        service: "analyze-trends",
        protocol: "x402",
        output: {
          trending_topics: topics,
          suggested_angles: angles,
          engagement_opportunities: [
            "Reply to 5 high-signal founder threads daily",
            xr?.top_topic ? `Double down on: ${xr.top_topic}` : "",
          ].filter(Boolean),
          grounded_in: xr ? "oscorp_groq_research" : "default",
        },
      });
    });
  },
});
