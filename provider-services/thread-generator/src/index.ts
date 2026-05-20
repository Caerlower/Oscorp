import { startPaidProvider } from "../../lib/createPaidApp.js";

startPaidProvider({
  port: Number(process.env.PORT ?? 8103),
  serviceName: "thread-generator",
  routeKey: "POST /generate-thread",
  price: "$0.05",
  description: "Full X thread generation",
  registerRoutes: (app) => {
    app.post("/generate-thread", async (c) => {
      const body = await c.req.json<{ topic: string; tone: string }>();
      const topic = body.topic?.trim() || "growth";
      const tone = body.tone?.trim() || "founder";
      const thread = [
        `1/ ${topic} is changing fast — here's what most teams miss.`,
        "2/ Distribution beats perfect messaging.",
        "3/ Post proof, not promises.",
        `4/ Match tone: ${tone}.`,
        "5/ End with one clear CTA.",
      ];
      return c.json({
        provider: "thread-generator",
        service: "generate-thread",
        protocol: "x402",
        output: { thread: thread.join("\n") },
      });
    });
  },
});
