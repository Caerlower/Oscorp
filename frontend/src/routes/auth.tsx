import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { WalletConnectPanel } from "@/components/wallet";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/hooks/useAuth";
import { navigateAfterAuth } from "@/utils/navigation";
import { prefersNativeWalletReconnect } from "@/services/auth";
import type { SessionConnect } from "@/services/api";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const raw = search.redirect;
    if (typeof raw !== "string" || !raw.startsWith("/")) {
      return {};
    }
    try {
      return { redirect: decodeURIComponent(raw) };
    } catch {
      return { redirect: raw };
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in · Oscorp" },
      { name: "description", content: "Sign in with your Algorand wallet to open the AI CMO terminal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { phase } = useAuth();
  const { status } = useSession();

  const needsReconnect = phase === "needs_reconnect";
  const nativeReconnect = needsReconnect && prefersNativeWalletReconnect();

  const onConnected = (session: SessionConnect) => {
    navigateAfterAuth(navigate, session, redirect);
  };

  useEffect(() => {
    if (phase !== "authenticated" || !status) return;
    navigateAfterAuth(navigate, status, redirect, true);
  }, [phase, status, navigate, redirect]);

  if (phase === "booting" || phase === "restoring") {
    return (
      <div className="auth-shell flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {phase === "booting" ? "Loading…" : "Restoring session…"}
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="auth-glow auth-glow-a" />
        <div className="auth-glow auth-glow-b" />
        <div className="auth-grid" />
      </div>

      <div className="auth-card relative w-full max-w-[440px]">
        <WalletConnectPanel
          variant={nativeReconnect ? "native" : "default"}
          onBack={() => navigate({ to: "/" })}
          onConnected={onConnected}
        />
      </div>
    </div>
  );
}
