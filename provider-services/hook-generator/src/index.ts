import { startPaidProvider } from "../../lib/createPaidApp.js";

startPaidProvider({
  port: Number(process.env.PORT ?? 8102),
  serviceName: "hook-generator",
  routeKey: "POST /generate-hooks",
  price: "$0.01",
  description: "Viral hook generation",
  registerRoutes: (app) => {
    app.post("/generate-hooks", async (c) => {
      const body = await c.req.json<{ topic: string; audience: string }>();
      const topic = body.topic?.trim() || "growth";
      const audience = body.audience?.trim() || "founders";
      const hooks = [
        `Most people get ${topic} wrong.`,
        `If you're building in ${audience}, read this.`,
        `Stop optimizing posts. Start optimizing distribution.`,
        `The real bottleneck in ${topic} isn't product — it's attention.`,
        `3 lessons from 30 days of ${topic} experiments.`,
        `Unpopular opinion: ${topic} is overcrowded because everyone sounds the same.`,
        `Founders in ${audience}: this one shift doubled replies for us.`,
        `You don't need more content. You need sharper hooks.`,
        `The best ${topic} posts are specific, not inspirational.`,
        `Save this if you're serious about ${audience} growth.`,
      ];
      // Rotate order each request so cycles don't always get the same first 3 hooks.
      for (let i = hooks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [hooks[i], hooks[j]] = [hooks[j], hooks[i]];
      }
      return c.json({
        provider: "hook-generator",
        service: "generate-hooks",
        protocol: "x402",
        output: { hooks },
      });
    });
  },
});
