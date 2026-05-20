import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useWallet } from "@txnlab/use-wallet-react";
import { Logo } from "@/components/Logo";
import { WalletConnectPanel } from "@/components/WalletConnectPanel";
import { useSession } from "@/context/SessionContext";
import { sessionHomePath } from "@/lib/session-routes";
import { isWalletExtensionConnected } from "@/lib/session-wallet";
import type { SessionConnect } from "@/lib/api";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const redirect =
      typeof search.redirect === "string" && search.redirect.startsWith("/")
        ? search.redirect
        : undefined;
    return { redirect };
  },
  head: () => ({
    meta: [
      { title: "Sign in · Oscorp" },
      { name: "description", content: "Connect your Algorand wallet to start." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { userId, walletAddress, status, loading } = useSession();
  const { activeAccount } = useWallet();
  const walletLinked = isWalletExtensionConnected(activeAccount?.address);
  const needsReconnect = !!userId && !!walletAddress && !walletLinked;

  useEffect(() => {
    if (!userId || loading || !status || !walletLinked) return;
    if (redirect && redirect !== "/auth") {
      navigate({ to: redirect, replace: true });
      return;
    }
    navigate({ to: sessionHomePath(status), replace: true });
  }, [userId, status, loading, walletLinked, navigate, redirect]);

  const onConnected = (session: SessionConnect) => {
    if (redirect && redirect !== "/auth") {
      navigate({ to: redirect });
      return;
    }
    navigate({ to: sessionHomePath(session) });
  };

  if (userId && loading && !status && !needsReconnect) {
    return (
      <AuthShell>
        <p className="text-sm text-muted-foreground">Restoring your session…</p>
      </AuthShell>
    );
  }

  if (userId && status && walletLinked) {
    return (
      <AuthShell>
        <p className="text-sm text-muted-foreground">Taking you back in…</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="sign-in-card w-full max-w-[440px] px-6 py-8 sm:px-8 sm:py-10">
        {needsReconnect && (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
            <p className="text-sm font-medium text-foreground">Reconnect your wallet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your Oscorp account is saved — link Pera, Defly, or Lute again to sign transactions.
            </p>
          </div>
        )}
        <WalletConnectPanel
          title={needsReconnect ? "Reconnect wallet" : "Sign in"}
          onConnected={onConnected}
        />
      </div>
      <Link
        to="/"
        className="mt-8 text-sm text-muted-foreground transition hover:text-foreground"
      >
        ← Back to home
      </Link>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[oklch(0.94_0.01_270)] px-4 py-12">
      <div className="absolute left-6 top-6">
        <Logo />
      </div>
      {children}
    </div>
  );
}
