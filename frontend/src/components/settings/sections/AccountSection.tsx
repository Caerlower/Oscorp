import { Link } from "@tanstack/react-router";
import { Copy, LogOut, Trash2, Wallet, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { useProfileIdentity } from "@/hooks/useProfileIdentity";
import { readLastWalletId } from "@/services/auth";
import { WalletId } from "@txnlab/use-wallet";

export function AccountSection() {
  const { userId, walletAddress } = useSession();
  const { disconnect } = useWalletConnect();
  const identity = useProfileIdentity();
  const [copied, setCopied] = useState(false);
  const usesSocialWallet = readLastWalletId() === WalletId.WEB3AUTH;

  const copyId = async () => {
    if (!userId) return;
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    toast.success("User ID copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const logout = async () => {
    await disconnect();
    window.location.href = "/";
  };

  if (!userId) {
    return (
      <div className="space-y-6">
        <header className="mc-settings-page-header">
          <h2 className="font-display text-2xl font-bold">Account & Security</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to view your Oscorp account.</p>
        </header>
        <Link to="/auth" search={{ redirect: "/settings" }} className="mc-btn-primary inline-flex px-4 py-2 text-sm">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="mc-settings-page-header">
        <h2 className="font-display text-2xl font-bold">Account & Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connected accounts, wallet session, and account controls.
        </p>
      </header>

      {usesSocialWallet ? (
        <section className="rounded-xl border border-border p-5">
          <p className="mc-section-label mb-4">Google account</p>
          <div className="flex items-center gap-4">
            {identity.profileImage ? (
              <img
                src={identity.profileImage}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="mc-company-avatar flex h-12 w-12 items-center justify-center rounded-full font-display text-sm font-bold text-white">
                {identity.initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-display font-semibold">{identity.name}</p>
              {identity.email ? (
                <p className="text-sm text-muted-foreground">{identity.email}</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-border p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          Connected wallet
        </h3>
        <dl className="space-y-3">
          <InfoRow label="Address" value={walletAddress ?? undefined} mono />
          <InfoRow label="User ID" value={userId} mono />
        </dl>
        <button
          type="button"
          onClick={() => void copyId()}
          className="mc-btn-secondary mt-4 inline-flex h-9 items-center gap-2 px-3 text-sm"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy user ID"}
        </button>
      </section>

      <section className="mc-danger-zone rounded-xl border border-border border-l-[3px] border-l-destructive p-5">
        <p className="mc-section-label mb-2 text-destructive">Danger zone</p>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all workspace data. This cannot be undone.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-destructive px-4 text-sm font-medium text-destructive transition hover:bg-destructive/5"
            onClick={() =>
              toast.message("Delete account", {
                description: "Contact support to request account deletion.",
              })
            }
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-sm font-medium ${mono ? "break-all font-mono text-xs" : ""}`}>{value ?? "—"}</dd>
    </div>
  );
}
