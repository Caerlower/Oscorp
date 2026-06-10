/**
 * Optional Node proxy for server-side x402-paid fetch (agent wallets, scripts).
 * The Oscorp dashboard uses createX402Fetch() in the browser instead.
 */
import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import algosdk from "algosdk";
import { toClientAvmSigner } from "@x402-avm/avm";
import { createX402Fetch } from "./index.js";

config();

const port = Number(process.env.PORT ?? 8110);
const avmMnemonic = process.env.AVM_MNEMONIC ?? "";

function secretKeyBase64FromMnemonic(mnemonic: string): string {
  const { sk } = algosdk.mnemonicToSecretKey(mnemonic.trim());
  return Buffer.from(sk).toString("base64");
}

const defaultSigner = avmMnemonic
  ? toClientAvmSigner(secretKeyBase64FromMnemonic(avmMnemonic))
  : null;

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "oscorp-x402-payer",
    defaultPayer: defaultSigner?.address ?? null,
  }),
);

app.post("/fetch", async (c) => {
  const body = await c.req.json<{
    url: string;
    method?: string;
    json?: unknown;
    payerMnemonic?: string;
  }>();

  if (!body.url) {
    return c.json({ error: "url is required" }, 400);
  }

  const mnemonic = body.payerMnemonic?.trim();
  const signer = mnemonic
    ? toClientAvmSigner(secretKeyBase64FromMnemonic(mnemonic))
    : defaultSigner;
  if (!signer) {
    return c.json({ error: "payerMnemonic is required (no default AVM_MNEMONIC)" }, 400);
  }

  const x402Fetch = createX402Fetch(signer);
  const method = (body.method ?? "POST").toUpperCase();
  const init: RequestInit = { method };
  if (body.json !== undefined && method !== "GET") {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body.json);
  }

  try {
    const response = await x402Fetch(body.url, init);
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    return c.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: parsed,
      payer: signer.address,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, status: 502, body: { error: msg }, payer: signer.address }, 502);
  }
});

console.info(
  `Oscorp x402 payer proxy on :${port}${defaultSigner ? ` (default ${defaultSigner.address})` : ""}`,
);
serve({ fetch: app.fetch, port });
