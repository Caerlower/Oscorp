import { useCallback, useEffect, useRef, useState } from "react";
import { WalletId } from "@txnlab/use-wallet";
import { AlertCircle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { WalletBrandIcon } from "@/components/wallet/brand-icon";
import { WALLET_BRANDS } from "@/utils/wallet-logos";
import { hasWeb3AuthConfig } from "@/constants/wallet-config";
import { readLastWalletId } from "@/services/auth";
import { GoogleMark } from "@/components/wallet/magic-icons";
import type { SessionConnect } from "@/services/api";

type ConnectVariant = "default" | "native";

function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <div className="h-px flex-1 bg-border/80" />
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/80" />
    </div>
  );
}

export function WalletConnectPanel({
  onConnected,
  onBack,
  variant = "default",
}: {
  onConnected?: (session: SessionConnect) => void;
  onBack?: () => void;
  variant?: ConnectVariant;
}) {
  const [email, setEmail] = useState("");

  const { connect, connectSocial, resumeWeb3AuthRedirect, busy, error, clearError, isReady: canUseWallets } =
    useWalletConnect();
  const redirectHandledRef = useRef(false);

  const hasWeb3Auth = hasWeb3AuthConfig();
  const showSocial = variant === "default" && hasWeb3Auth;
  const disabled = busy || !canUseWallets;
  const googleLastUsed = readLastWalletId() === WalletId.WEB3AUTH;

  const pickWallet = useCallback(
    async (id: WalletId) => {
      clearError();
      try {
        const session = await connect(id);
        onConnected?.(session);
      } catch {
        /* surfaced below */
      }
    },
    [clearError, connect, onConnected],
  );

  const pickGoogle = useCallback(async () => {
    clearError();
    try {
      const session = await connectSocial("google");
      onConnected?.(session);
    } catch {
      /* surfaced below */
    }
  }, [clearError, connectSocial, onConnected]);

  useEffect(() => {
    if (!showSocial || !canUseWallets || busy || redirectHandledRef.current) return;
    redirectHandledRef.current = true;
    void resumeWeb3AuthRedirect().then((session) => {
      if (session) onConnected?.(session);
    });
  }, [showSocial, canUseWallets, busy, resumeWeb3AuthRedirect, onConnected]);

  const pickEmail = useCallback(async () => {
    clearError();
    try {
      const session = await connectSocial("email", email);
      onConnected?.(session);
    } catch {
      /* surfaced below */
    }
  }, [clearError, connectSocial, email, onConnected]);

  return (
    <div className="relative px-7 py-8 sm:px-9 sm:py-9">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="auth-back-btn absolute left-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition disabled:opacity-50"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      )}

      <div className="mx-auto max-w-[340px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="auth-logo-frame mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm">
            <img src="/oscorp-mark.svg" alt="" className="h-8 w-8" draggable={false} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {variant === "native"
              ? "Reconnect your Algorand wallet to continue."
              : "Sign in to your AI CMO terminal"}
          </p>
        </div>

        {!canUseWallets ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Loading wallets…
          </div>
        ) : (
          <div className="space-y-5">
            {showSocial && (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void pickGoogle()}
                  className="auth-btn-google relative flex w-full items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 text-sm font-medium transition disabled:opacity-50"
                >
                  <GoogleMark className="h-[18px] w-[18px]" />
                  {busy ? "Signing in…" : "Continue with Google"}
                  {googleLastUsed && !busy && (
                    <span className="auth-badge absolute right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                      Last used
                    </span>
                  )}
                </button>

                <OrDivider />

                <div className="space-y-2">
                  <label htmlFor="auth-email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Work email
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && email.trim() && !disabled) {
                          void pickEmail();
                        }
                      }}
                      className="field-input min-w-0 flex-1 rounded-2xl"
                    />
                    <button
                      type="button"
                      disabled={disabled || !email.trim()}
                      onClick={() => void pickEmail()}
                      aria-label="Continue with email"
                      className="auth-btn-primary inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl transition disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <OrDivider label="wallets" />
              </>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              {WALLET_BRANDS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => void pickWallet(w.id)}
                  className="auth-wallet-pill group flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-center transition disabled:opacity-50"
                >
                  <WalletBrandIcon walletId={w.id} size={36} className="ring-0" />
                  <span className="text-xs font-medium text-foreground/90 group-hover:text-foreground">
                    {w.name.replace(" Wallet", "")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="auth-error mt-5 flex gap-2 rounded-2xl border px-3.5 py-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <p className="mx-auto mt-8 max-w-[320px] text-center text-[11px] leading-relaxed text-muted-foreground/90">
        By continuing, you agree to our{" "}
        <a href="/" className="font-medium text-foreground/70 underline-offset-2 hover:text-foreground hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/" className="font-medium text-foreground/70 underline-offset-2 hover:text-foreground hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
