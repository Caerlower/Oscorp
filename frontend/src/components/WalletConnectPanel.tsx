import { useEffect, useState } from "react";
import { WalletId } from "@txnlab/use-wallet";
import { useWallet } from "@txnlab/use-wallet-react";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { useWalletClientReady } from "@/context/WalletReadyContext";
import { getWeb3AuthClientId, hasWeb3AuthConfig } from "@/lib/wallet-config";
import { WalletBrandIcon } from "@/components/WalletBrandIcon";
import { WALLET_BRANDS } from "@/lib/wallet-logos";
import type { SessionConnect } from "@/lib/api";

function SocialIconButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-white text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function WalletRow({
  name,
  walletId,
  disabled,
  onClick,
}: {
  name: string;
  walletId: (typeof WALLET_BRANDS)[number]["id"];
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-2xl border border-border bg-white px-4 py-3.5 text-left transition hover:border-foreground/25 hover:bg-muted/30 disabled:opacity-50"
    >
      <WalletBrandIcon walletId={walletId} size={40} />
      <span className="flex-1 text-[15px] font-medium text-foreground">{name}</span>
    </button>
  );
}

export function WalletConnectPanel({
  onConnected,
  title = "Sign in",
}: {
  onConnected?: (session: SessionConnect) => void;
  title?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const clientReady = useWalletClientReady();
  const { wallets, isReady } = useWallet();
  const { connect, busy, web3AuthFlow, error, clearError } = useWalletConnect();

  useEffect(() => setMounted(true), []);

  const web3AuthInManager = wallets?.some((w) => w.id === WalletId.WEB3AUTH) ?? false;
  const hasWeb3Auth = hasWeb3AuthConfig() || web3AuthInManager;
  const web3AuthClientId = getWeb3AuthClientId();
  const walletsLoading = mounted && (!clientReady || !isReady);
  const canConnect = mounted && clientReady && isReady;

  const pick = async (id: WalletId) => {
    clearError();
    try {
      const session = await connect(id);
      onConnected?.(session);
    } catch {
      /* hook sets error */
    }
  };

  if (web3AuthFlow) {
    return (
      <div className="mx-auto flex w-full max-w-[400px] flex-col items-center px-4 py-16 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium text-foreground">Continue in the sign-in window</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Complete Google or email login in the overlay — not a second popup inside this card.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[400px]">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>

      <div className="mt-8">
        {hasWeb3Auth ? (
          <>
            <div className="flex items-center justify-center gap-3">
              <SocialIconButton
                label="Google"
                disabled={busy || !canConnect}
                onClick={() => void pick(WalletId.WEB3AUTH)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </SocialIconButton>
              <SocialIconButton
                label="Email"
                disabled={busy || !canConnect}
                onClick={() => void pick(WalletId.WEB3AUTH)}
              >
                <Mail className="h-5 w-5 text-foreground/70" />
              </SocialIconButton>
            </div>

            <button
              type="button"
              disabled={busy || !canConnect}
              onClick={() => void pick(WalletId.WEB3AUTH)}
              className="btn-signin-outline mt-4 w-full"
            >
              Continue with Email / Phone
            </button>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-5 text-center text-sm text-muted-foreground">
            <p>
              Add <code className="text-foreground">VITE_WEB3AUTH_CLIENT_ID</code> to enable
              Google & email login.
            </p>
            {web3AuthClientId.length > 0 && web3AuthClientId.length <= 10 && (
              <p className="mt-1 text-xs text-amber-700">Client ID looks too short.</p>
            )}
          </div>
        )}
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">OR</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {walletsLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading wallets…
        </div>
      ) : (
        <div className="space-y-2.5">
          {WALLET_BRANDS.map((w) => (
            <WalletRow
              key={w.id}
              name={w.name}
              walletId={w.id}
              disabled={busy || !canConnect}
              onClick={() => void pick(w.id)}
            />
          ))}
        </div>
      )}

      {busy && !web3AuthFlow && (
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Approve in your wallet…
        </p>
      )}

      {error && (
        <div className="mt-4 flex gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Algorand <span className="font-medium text-foreground">TestNet</span>
        {hasWeb3Auth && (
          <>
            {" "}
            · Powered by{" "}
            <span className="font-semibold text-foreground/80">MetaMask</span> Embedded Wallets
          </>
        )}
      </p>
    </div>
  );
}
