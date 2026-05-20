import { useLocation, useNavigate } from "@tanstack/react-router";
import { Wallet, LogOut } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { useSession } from "@/context/SessionContext";
import { isWalletExtensionConnected } from "@/lib/session-wallet";
import { cn } from "@/lib/utils";

type ConnectWalletButtonProps = {
  className?: string;
  /** Sidebar account card vs compact header chip */
  variant?: "inline" | "sidebar";
};

export function ConnectWalletButton({
  className = "",
  variant = "inline",
}: ConnectWalletButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeAccount, disconnect, busy } = useWalletConnect();
  const { walletAddress } = useSession();

  const extensionConnected = isWalletExtensionConnected(activeAccount?.address);
  const needsReconnect = !!walletAddress && !extensionConnected;

  const goAuth = () => {
    const redirect =
      location.pathname !== "/auth" && location.pathname !== "/"
        ? location.pathname
        : undefined;
    navigate({
      to: "/auth",
      search: redirect ? { redirect } : {},
    });
  };

  if (extensionConnected) {
    const address = activeAccount!.address;
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

    if (variant === "sidebar") {
      return (
        <div
          className={cn(
            "rounded-2xl border border-border/70 bg-gradient-to-br from-white via-white to-muted/40 p-3.5 shadow-soft",
            className,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Wallet
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-800">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
              Connected
            </span>
          </div>
          <p
            className="mt-2.5 font-mono text-sm font-medium tracking-tight text-foreground"
            title={address}
          >
            {short}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnect()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-white/90 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-border hover:bg-white hover:text-foreground disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      );
    }

    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        <span
          className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white px-3.5 py-2 text-sm font-medium text-foreground shadow-soft"
          title={address}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25" />
          <span className="font-mono tracking-tight">{short}</span>
        </span>
        <button
          type="button"
          title="Disconnect"
          disabled={busy}
          onClick={() => void disconnect()}
          className="rounded-xl border border-transparent p-2 text-muted-foreground transition hover:border-border hover:bg-white hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (needsReconnect && walletAddress && variant === "sidebar") {
    const short = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
    return (
      <div
        className={cn(
          "rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-white to-muted/40 p-3.5 shadow-soft",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Wallet
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-900">
            Reconnect
          </span>
        </div>
        <p
          className="mt-2.5 font-mono text-sm font-medium tracking-tight text-foreground/80"
          title={walletAddress}
        >
          {short}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Extension not linked — tap to reconnect</p>
        <button
          type="button"
          disabled={busy}
          onClick={goAuth}
          className="btn-primary mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm"
        >
          <Wallet className="h-4 w-4 shrink-0" />
          Reconnect wallet
        </button>
      </div>
    );
  }

  const connectClass =
    variant === "sidebar"
      ? "btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm"
      : "btn-primary inline-flex items-center gap-2 text-sm";

  return (
    <button
      type="button"
      disabled={busy}
      onClick={goAuth}
      className={cn(connectClass, className)}
    >
      <Wallet className="h-4 w-4 shrink-0" />
      {needsReconnect ? "Reconnect wallet" : "Connect wallet"}
    </button>
  );
}
