import { config } from "dotenv";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import algosdk from "algosdk";
import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { toClientAvmSigner, ExactAvmScheme, ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

config();

const port = Number(process.env.PORT ?? 8110);
const avmMnemonic = process.env.AVM_MNEMONIC ?? "";

/** @x402/avm expects base64-encoded 64-byte Algorand secret key (not algo25 wrapped seed). */
function secretKeyBase64FromMnemonic(mnemonic: string): string {
  const { sk } = algosdk.mnemonicToSecretKey(mnemonic.trim());
  return Buffer.from(sk).toString("base64");
}

async function payerFromMnemonic(mnemonic: string) {
  const signer = toClientAvmSigner(secretKeyBase64FromMnemonic(mnemonic));
  const client = new x402Client();
  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer));
  return { signer, fetchWithPayment: wrapFetchWithPayment(fetch, client), httpClient: new x402HTTPClient(client) };
}

const defaultPayer = avmMnemonic ? await payerFromMnemonic(avmMnemonic) : null;
const avmSigner = defaultPayer?.signer;

const app = new Hono();

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "oscorp-x402-payer",
    network: ALGORAND_TESTNET_CAIP2,
    defaultPayer: avmSigner?.address ?? null,
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

  const method = (body.method ?? "POST").toUpperCase();
  const init: RequestInit = { method };
  if (body.json !== undefined && method !== "GET") {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body.json);
  }

  const mnemonic = body.payerMnemonic?.trim();
  if (!mnemonic) {
    if (!defaultPayer) {
      return c.json({ error: "payerMnemonic is required (no default AVM_MNEMONIC)" }, 400);
    }
  }
  const payer = mnemonic ? await payerFromMnemonic(mnemonic) : defaultPayer!;

  let response: Response;
  try {
    response = await payer.fetchWithPayment(body.url, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isFetch =
      msg.includes("fetch failed") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("Failed to fetch");
    const detail = isFetch
      ? `${msg} — start provider services (trend-analyzer :8101, hook-generator :8102).`
      : msg;
    return c.json({
      ok: false,
      status: 502,
      statusText: "x402 payment error",
      body: { error: detail },
      payment: null,
      payer: payer.signer.address,
    });
  }

  let parsed: unknown = null;
  const text = await response.text();
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  let payment: unknown = null;
  if (response.ok) {
    payment = payer.httpClient.getPaymentSettleResponse((name) => response.headers.get(name));
  }

  const hint =
    response.status === 402
      ? "Payment not accepted. Ensure agent has TestNet USDC, is opted into USDC ASA 10458941, and x402-payer was restarted after signer fix."
      : undefined;

  return c.json({
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: parsed,
    payment,
    payer: payer.signer.address,
    hint,
  });
});

console.info(
  `Oscorp x402 payer ready on :${port}${avmSigner ? ` (default ${avmSigner.address})` : " (per-request mnemonic only)"}`,
);
serve({ fetch: app.fetch, port });
