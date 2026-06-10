import type { X402FetchFn } from "@/hooks/useX402Fetch";
import { parseJsonResponse } from "@/services/http-response";

export async function x402Post<T>(
  x402Fetch: X402FetchFn,
  path: string,
  body: unknown,
  agent?: import("@/constants/payment-constants").PaidAgent,
): Promise<T> {
  const res = await x402Fetch(path, {
    method: "POST",
    body: JSON.stringify(body),
    agent,
  });
  return parseJsonResponse<T>(res, { append402Reason: true });
}
