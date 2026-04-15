import Fastify from "fastify";
import algosdk from "algosdk";
import { z } from "zod";
import { env } from "./config.js";
import { getAlgodClient } from "./algorand.js";
import { createOscorp, getOscorpState, updateOscorpPolicy } from "./oscorp-service.js";
import { createOscorpSchema, distributeRevenueSchema, updateOscorpPolicySchema } from "./schemas.js";

const app = Fastify({ logger: true });
const usedPaymentTxIds = new Set<string>();
const serviceCatalog = new Map<number, {
  appId: number;
  serviceName: string;
  description: string;
  priceMicroUsdc: number;
  providerAddress: string;
  updatedAt: string;
}>();

app.addHook("preHandler", async (request, reply) => {
  if (!request.url.startsWith("/v1/")) {
    return;
  }
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing Authorization bearer token" });
  }
  const provided = auth.slice("Bearer ".length).trim();
  if (provided !== env.OSCORP_API_KEY) {
    return reply.status(403).send({ error: "Invalid OSCORP_API_KEY" });
  }
});

async function sendUsdcPayment(params: {
  to: string;
  amountMicroUsdc: number;
}) {
  if (!env.OSCORP_PAYMENT_MNEMONIC) {
    throw new Error("OSCORP_PAYMENT_MNEMONIC is not configured");
  }
  const algod = getAlgodClient();
  const sender = algosdk.mnemonicToSecretKey(env.OSCORP_PAYMENT_MNEMONIC);
  const suggested = await algod.getTransactionParams().do();
  const tx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: sender.addr,
    receiver: params.to,
    amount: params.amountMicroUsdc,
    assetIndex: env.USDC_ASSET_ID,
    suggestedParams: suggested,
  });
  const signed = tx.signTxn(sender.sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
  return {
    txId: txid,
    sender: sender.addr.toString(),
    receiver: params.to,
    amountMicroUsdc: params.amountMicroUsdc,
    usdcAssetId: env.USDC_ASSET_ID,
  };
}

async function verifyUsdcTransferTx(params: {
  txId: string;
  expectedReceiver: string;
  expectedAmountMicroUsdc: number;
}) {
  const algod = getAlgodClient();
  let txn: Record<string, unknown> | undefined;
  let lastLookupError: unknown;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const res = await algod.pendingTransactionInformation(params.txId).do();
      const confirmedRound = Number(
        (res as { confirmedRound?: number; ["confirmed-round"]?: number }).confirmedRound
          ?? (res as { ["confirmed-round"]?: number })["confirmed-round"]
          ?? 0,
      );
      if (confirmedRound > 0) {
        txn = res as unknown as Record<string, unknown>;
        break;
      }
    } catch (error) {
      lastLookupError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  if (!txn) {
    return {
      ok: false,
      reason:
        lastLookupError instanceof Error
          ? `Transaction lookup pending: ${lastLookupError.message}`
          : "Transaction lookup pending",
    } as const;
  }
  const txnEnvelope = (txn["txn"] as Record<string, unknown> | undefined) ?? {};
  const innerTxn = (txnEnvelope["txn"] as Record<string, unknown> | undefined) ?? txnEnvelope;
  const txType = String(innerTxn["type"] ?? "");
  if (txType !== "axfer") {
    return { ok: false, reason: "Transaction is not an asset transfer" } as const;
  }

  const assetTransfer = (innerTxn["assetTransfer"] as Record<string, unknown> | undefined) ?? {};
  const transferAssetId = Number(
    assetTransfer["assetIndex"] ?? innerTxn["xaid"] ?? innerTxn["assetId"] ?? 0,
  );
  if (transferAssetId !== env.USDC_ASSET_ID) {
    return { ok: false, reason: "Asset ID mismatch" } as const;
  }
  const amount = Number(assetTransfer["amount"] ?? innerTxn["aamt"] ?? innerTxn["amount"] ?? 0);
  if (amount < params.expectedAmountMicroUsdc) {
    return { ok: false, reason: "Transfer amount too low" } as const;
  }
  const receiver = String(
    assetTransfer["receiver"] ?? innerTxn["arcv"] ?? innerTxn["receiver"] ?? "",
  );
  if (receiver !== params.expectedReceiver) {
    return { ok: false, reason: "Receiver mismatch" } as const;
  }
  return {
    ok: true,
    sender: String(innerTxn["snd"] ?? txn["sender"] ?? ""),
    receiver,
    amountMicroUsdc: amount,
    confirmedRound: Number(txn["confirmed-round"] ?? txn.confirmedRound ?? 0),
  } as const;
}

app.get("/health", async () => ({ ok: true }));

app.post("/v1/oscorp", async (request, reply) => {
  const parsed = createOscorpSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Validation failed",
      issues: z.treeifyError(parsed.error),
    });
  }

  try {
    const created = await createOscorp(parsed.data);
    return reply.status(201).send(created);
  } catch (error) {
    request.log.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return reply.status(500).send({ error: message });
  }
});

app.patch("/v1/oscorp/policy", async (request, reply) => {
  const parsed = updateOscorpPolicySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Validation failed",
      issues: z.treeifyError(parsed.error),
    });
  }
  try {
    const updated = await updateOscorpPolicy(parsed.data);
    return reply.status(200).send(updated);
  } catch (error) {
    request.log.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return reply.status(500).send({ error: message });
  }
});

app.get("/v1/oscorp/:appId/state", async (request, reply) => {
  const appId = Number((request.params as { appId: string }).appId);
  if (!Number.isInteger(appId) || appId <= 0) {
    return reply.status(400).send({ error: "Invalid appId" });
  }
  try {
    const state = await getOscorpState(appId);
    return reply.status(200).send(state);
  } catch (error) {
    request.log.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return reply.status(500).send({ error: message });
  }
});

app.post("/v1/oscorp/revenue/distribute", async (request, reply) => {
  const parsed = distributeRevenueSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Validation failed",
      issues: z.treeifyError(parsed.error),
    });
  }
  // Kept as a staged endpoint until x402/payment orchestration is plugged in.
  return reply.status(202).send({
    status: "accepted",
    message: "Revenue distribution endpoint staged. On-chain grouped distribution will be wired next.",
    payload: parsed.data,
  });
});

const reportActivitySchema = z.object({
  type: z.string().min(1).max(64),
  content: z.string().min(1).max(5000),
  channel: z.string().min(1).max(128).default("agent"),
});

app.post("/v1/oscorp/:appId/activity", async (request, reply) => {
  const appId = Number((request.params as { appId: string }).appId);
  if (!Number.isInteger(appId) || appId <= 0) {
    return reply.status(400).send({ error: "Invalid appId" });
  }
  const parsed = reportActivitySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Validation failed",
      issues: z.treeifyError(parsed.error),
    });
  }
  const activity = {
    appId,
    ...parsed.data,
    createdAt: new Date().toISOString(),
  };
  request.log.info({ activity }, "Oscorp activity reported");
  return reply.status(201).send(activity);
});

const registerServiceSchema = z.object({
  serviceName: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  priceMicroUsdc: z.number().int().positive(),
  providerAddress: z.string().min(10).max(128),
});

app.put("/v1/oscorp/:appId/service", async (request, reply) => {
  const appId = Number((request.params as { appId: string }).appId);
  if (!Number.isInteger(appId) || appId <= 0) {
    return reply.status(400).send({ error: "Invalid appId" });
  }
  const parsed = registerServiceSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Validation failed",
      issues: z.treeifyError(parsed.error),
    });
  }
  const entry = {
    appId,
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };
  serviceCatalog.set(appId, entry);
  return reply.status(200).send(entry);
});

const x402PaySchema = z.object({
  to: z.string().min(10).max(128),
  amountMicroUsdc: z.number().int().positive(),
});

app.post("/v1/oscorp/:appId/x402/pay", async (request, reply) => {
  const appId = Number((request.params as { appId: string }).appId);
  if (!Number.isInteger(appId) || appId <= 0) {
    return reply.status(400).send({ error: "Invalid appId" });
  }
  const parsed = x402PaySchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Validation failed",
      issues: z.treeifyError(parsed.error),
    });
  }
  try {
    const payment = await sendUsdcPayment(parsed.data);
    return reply.status(201).send({
      appId,
      protocol: "x402",
      payment,
      status: "confirmed",
    });
  } catch (error) {
    request.log.error(error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return reply.status(500).send({ error: message });
  }
});

app.get("/v1/services", async () => {
  return {
    data: Array.from(serviceCatalog.values()),
    count: serviceCatalog.size,
  };
});

app.get("/v1/oscorp/:appId/service", async (request, reply) => {
  const appId = Number((request.params as { appId: string }).appId);
  if (!Number.isInteger(appId) || appId <= 0) {
    return reply.status(400).send({ error: "Invalid appId" });
  }
  const service = serviceCatalog.get(appId);
  if (!service) {
    return reply.status(404).send({ error: "Service not found" });
  }
  // x402-lite challenge response
  return reply.status(402).send({
    type: "payment_required",
    protocol: "x402-lite",
    accepts: {
      asset: "USDC",
      amountMicroUsdc: service.priceMicroUsdc,
      payTo: service.providerAddress,
    },
    service,
  });
});

const purchaseServiceSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
});

app.post("/v1/oscorp/:appId/service", async (request, reply) => {
  const appId = Number((request.params as { appId: string }).appId);
  if (!Number.isInteger(appId) || appId <= 0) {
    return reply.status(400).send({ error: "Invalid appId" });
  }
  const service = serviceCatalog.get(appId);
  if (!service) {
    return reply.status(404).send({ error: "Service not found" });
  }
  const parsed = purchaseServiceSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.status(400).send({
      error: "Validation failed",
      issues: z.treeifyError(parsed.error),
    });
  }

  const paymentHeader = request.headers["x-payment"];
  if (!paymentHeader || typeof paymentHeader !== "string") {
    return reply.status(402).send({
      error: "Missing X-PAYMENT header",
      required: { amountMicroUsdc: service.priceMicroUsdc, asset: "USDC" },
    });
  }

  // Expected format: x402 <base64-json>
  const firstHeaderValue = paymentHeader.split(",")[0]?.trim() ?? "";
  const [prefix, tokenRaw] = firstHeaderValue.split(/\s+/, 2);
  const token = (tokenRaw ?? "").replace(/^"|"$/g, "").trim();
  request.log.info(
    {
      xPaymentPrefix: prefix,
      xPaymentChars: token.length,
      xPaymentSample: token.slice(0, 24),
    },
    "x402 payment header received",
  );
  if (prefix !== "x402" || !token) {
    return reply.status(402).send({ error: "Invalid X-PAYMENT format" });
  }

  let decoded: {
    payerAppId: number;
    txId: string;
    amountMicroUsdc: number;
    nonce: string;
    timestamp: string;
  };
  try {
    // Accept both base64 and base64url variants and normalize padding.
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const tokenText = Buffer.from(`${normalized}${padding}`, "base64").toString("utf-8");
    decoded = JSON.parse(tokenText) as typeof decoded;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    request.log.warn({ detail }, "x402 payment token parse failed");
    return reply.status(402).send({ error: "Invalid X-PAYMENT token payload", detail });
  }

  if (!decoded.amountMicroUsdc || decoded.amountMicroUsdc < service.priceMicroUsdc) {
    return reply.status(402).send({ error: "Insufficient payment amount" });
  }
  if (!decoded.txId) {
    return reply.status(402).send({ error: "Missing txId in payment token" });
  }
  if (usedPaymentTxIds.has(decoded.txId)) {
    return reply.status(409).send({ error: "Payment txId already consumed" });
  }
  const verified = await verifyUsdcTransferTx({
    txId: decoded.txId,
    expectedReceiver: service.providerAddress,
    expectedAmountMicroUsdc: service.priceMicroUsdc,
  });
  if (!verified.ok) {
    return reply.status(402).send({ error: `Payment verification failed: ${verified.reason}` });
  }
  usedPaymentTxIds.add(decoded.txId);

  return reply.status(200).send({
    status: "paid",
    protocol: "x402",
    payment: decoded,
    transfer: verified,
    service: {
      appId: service.appId,
      serviceName: service.serviceName,
      description: service.description,
    },
    result: {
      message: "Service fulfilled (phase 4 scaffold).",
      output: {
        recommendation: "Run 3-day GTM sprint with two variants and track qualified leads.",
        payloadEcho: parsed.data.payload ?? null,
      },
    },
  });
});

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
