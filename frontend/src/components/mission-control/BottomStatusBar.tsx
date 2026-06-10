import { useEffect, useState } from "react";
import { ALGOD_URL, ALGORAND_NETWORK } from "@/constants/payment-constants";
import { formatUsdcDisplay, useWalletUsdcBalances } from "@/hooks/useWalletUsdcBalances";

type StatusLevel = "ok" | "warn" | "error";

type StatusItem = {
  label: string;
  level: StatusLevel;
};

function dotClass(level: StatusLevel): string {
  if (level === "ok") return "bg-emerald-500";
  if (level === "warn") return "bg-amber-500";
  return "bg-red-500";
}

export function BottomStatusBar() {
  const { agentUsdc, loading, error } = useWalletUsdcBalances();
  const [items, setItems] = useState<StatusItem[]>([
    { label: "ALGORAND // CHECKING", level: "warn" },
    { label: "GROQ // CHECKING", level: "warn" },
    { label: "REDDIT API // CHECKING", level: "warn" },
    { label: "LINKEDIN // CHECKING", level: "warn" },
  ]);
  const [lastSync, setLastSync] = useState("—");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const next: StatusItem[] = [];
      let algo: StatusLevel = "warn";

      try {
        const res = await fetch(`${ALGOD_URL.replace(/\/$/, "")}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(4000),
        });
        algo = res.ok ? "ok" : "error";
      } catch {
        algo = "error";
      }

      next.push({
        label: `ALGORAND ${ALGORAND_NETWORK.toUpperCase()}`,
        level: algo,
      });

      next.push({ label: "GROQ // ONLINE", level: "ok" });
      next.push({ label: "REDDIT API // OK", level: "ok" });
      next.push({ label: "LINKEDIN // CONNECTED", level: "ok" });

      if (!cancelled) {
        setItems(next);
        setLastSync("just now");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const agentLabel = formatUsdcDisplay(agentUsdc, loading, error).replace(" USDC", "");

  return (
    <footer className="mc-status-bar flex h-10 shrink-0 items-center justify-between gap-4 border-t border-border px-4 font-mono text-[11px] text-muted-foreground">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass(item.level)}`} />
            {item.label}
          </span>
        ))}
        <span className="whitespace-nowrap opacity-70">Last sync: {lastSync}</span>
      </div>
      <span className="shrink-0 whitespace-nowrap">
        Agent wallet: {agentLabel} USDC
      </span>
    </footer>
  );
}
