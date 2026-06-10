import { FolderOpen, MessageSquare, Hexagon } from "lucide-react";
import { ProfileMenu } from "@/components/OscorpChrome";
import { useSession } from "@/context/SessionContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { formatUsdcDisplay, useWalletUsdcBalances } from "@/hooks/useWalletUsdcBalances";

function truncateWallet(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function TopBar({
  company,
  companyOpen,
  chatOpen,
  agentCount,
  onToggleCompany,
  onToggleChat,
}: {
  company: string;
  companyOpen: boolean;
  chatOpen: boolean;
  agentCount: number;
  onToggleCompany: () => void;
  onToggleChat: () => void;
}) {
  const { walletAddress } = useSession();
  const { status: analysisStatus } = useAnalysis();
  const { mainUsdc, agentUsdc, loading, error } = useWalletUsdcBalances();

  const runtimeLive = analysisStatus === "live" || analysisStatus === "loading";
  const balanceLabel = formatUsdcDisplay(mainUsdc, loading, error);

  const tooltip =
    mainUsdc != null || agentUsdc != null
      ? `Main wallet: ${mainUsdc != null ? `${mainUsdc.toFixed(2)} USDC` : "--"}\nAgent wallet: ${agentUsdc != null ? `${agentUsdc.toFixed(2)} USDC` : "--"}`
      : undefined;

  return (
    <header className="mc-top-bar flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <button
        type="button"
        onClick={onToggleCompany}
        className={`mc-btn-secondary inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${
          companyOpen ? "border-primary/40 bg-primary/5" : ""
        }`}
        aria-expanded={companyOpen}
      >
        <FolderOpen className="h-4 w-4" />
        <span className="hidden sm:inline">Company Intel</span>
        {company ? (
          <span className="max-w-[8rem] truncate font-mono text-[11px] normal-case tracking-normal text-muted-foreground">
            {company}
          </span>
        ) : null}
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <Hexagon className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.25} />
        <span className="font-display text-lg font-bold tracking-[0.2em]">OSCORP</span>
      </div>

      <div className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground md:flex">
        <span
          className={`h-2 w-2 rounded-full ${runtimeLive ? "bg-emerald-500 mc-pulse-dot" : "bg-amber-500"}`}
        />
        RUNTIME // {analysisStatus === "loading" ? "LIVE" : runtimeLive ? "LIVE" : "IDLE"}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="mc-status-pill hidden font-mono text-[10px] uppercase tracking-wider sm:inline-flex">
          {agentCount} Agents
        </span>

        {walletAddress ? (
          <span
            className="mc-wallet-pill hidden items-center gap-1.5 font-mono text-[11px] sm:inline-flex"
            title={tooltip}
          >
            {truncateWallet(walletAddress)}
            <span className="text-muted-foreground">· {balanceLabel}</span>
          </span>
        ) : null}

        <button
          type="button"
          onClick={onToggleChat}
          className={`mc-btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${
            chatOpen ? "ring-1 ring-primary/30" : ""
          }`}
          aria-expanded={chatOpen}
        >
          <MessageSquare className="h-4 w-4" />
          AI CMO
        </button>

        <ProfileMenu variant="light" />
      </div>
    </header>
  );
}
