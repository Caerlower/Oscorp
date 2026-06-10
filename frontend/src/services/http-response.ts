export type PaymentRequiredDetail = {
  error: string;
  amount?: number;
  currency?: string;
  recipient?: string;
  asset_id?: number;
};

export class PaymentRequiredError extends Error {
  detail: PaymentRequiredDetail;
  constructor(detail: PaymentRequiredDetail) {
    super(detail.error);
    this.detail = detail;
  }
}

function parse402Detail(rawDetail: unknown): PaymentRequiredDetail {
  if (typeof rawDetail === "string") return { error: rawDetail };
  if (typeof rawDetail === "object" && rawDetail !== null) {
    return rawDetail as PaymentRequiredDetail;
  }
  return { error: "Payment required" };
}

export async function parseJsonResponse<T>(
  res: Response,
  options?: { append402Reason?: boolean },
): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    if (res.status === 402) {
      const rawDetail =
        typeof err === "object" && err !== null && "detail" in err ? err.detail : "Payment required";
      const detail = parse402Detail(rawDetail);
      if (options?.append402Reason) {
        const reason =
          typeof rawDetail === "object" && rawDetail !== null && "reason" in rawDetail
            ? String((rawDetail as { reason?: unknown }).reason ?? "")
            : "";
        const message = reason ? `${detail.error ?? "Payment required"} (${reason})` : detail.error;
        throw new PaymentRequiredError({ ...detail, error: message ?? "Payment required" });
      }
      throw new PaymentRequiredError(detail);
    }
    if (typeof err === "object" && err !== null && "error" in err && typeof err.error === "string") {
      throw new Error(err.error);
    }
    const detail = typeof err === "object" && err !== null && "detail" in err ? err.detail : err;
    throw new Error(typeof detail === "string" ? detail : res.statusText);
  }
  return res.json() as Promise<T>;
}
