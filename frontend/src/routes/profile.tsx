import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, MessageCircle, Shield, Wallet, User, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SetupChecklist } from "@/components/SetupChecklist";
import { WalletConnectPanel } from "@/components/WalletConnectPanel";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useSession } from "@/context/SessionContext";
import { microToUsd } from "@/lib/algorand";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · Oscorp" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId, walletAddress, status } = useSession();
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    if (!userId) return;
    await navigator.clipboard.writeText(userId);
    setCopied(true);
    toast.success("User ID copied");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!userId) {
    return (
      <AppShell>
        <PageHeader
          title="Your profile"
          subtitle="Connect a wallet to create your Oscorp operator account."
        />
        <div className="mx-auto max-w-md sign-in-card p-6 md:p-8">
          <WalletConnectPanel />
        </div>
      </AppShell>
    );
  }

  const policy = status?.policy as Record<string, string> | undefined;
  const xHandle = policy?.x_handle?.replace(/^@+/, "");
  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`
    : "—";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Account"
        title="Profile"
        subtitle="Wallets, growth policy, and Telegram linking."
      />

      <div className="mb-6 surface-card flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-grad-lavender text-xl font-bold text-foreground/70">
          <User className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{xHandle ? `@${xHandle}` : "Oscorp operator"}</p>
          <p className="font-mono text-xs text-muted-foreground">{shortWallet}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            ok={!!status?.policy_signed}
            okLabel="Policy signed"
            warnLabel="Policy pending"
          />
          <StatusBadge
            ok={!!status?.agent_funded}
            okLabel="Agent funded"
            warnLabel="Agent unfunded"
          />
          <StatusBadge
            ok={!!status?.telegram_linked}
            okLabel="Telegram linked"
            warnLabel="Telegram not linked"
          />
        </div>
      </div>

      <div className="mb-6">
        <SetupChecklist status={status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface-card p-6 md:p-8">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-mint">
              <Wallet className="h-4 w-4" />
            </span>
            Wallets
          </h2>
          <dl className="mt-5 space-y-4">
            <InfoRow label="Your wallet" value={walletAddress} mono />
            <InfoRow label="Agent wallet (x402)" value={status?.agent_address} mono />
            <InfoRow
              label="Agent balance"
              value={`$${microToUsd(status?.usdc_micro ?? 0)} USDC`}
            />
          </dl>
          {!status?.agent_funded && (
            <Link to="/agent" className="btn-primary mt-5 inline-flex items-center gap-2 text-sm">
              Fund agent
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </section>

        <section className="surface-card p-6 md:p-8">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-peach">
              <Shield className="h-4 w-4" />
            </span>
            Growth policy
          </h2>
          {status?.policy_signed && policy ? (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <PolicyField label="X handle" value={policy.x_handle} />
              <PolicyField label="Niche" value={policy.niche} />
              <PolicyField label="Goal" value={policy.growth_goal} />
              <PolicyField label="Tone" value={policy.tone} />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Policy not signed yet.</p>
          )}
          <Link
            to="/onboarding"
            className="mt-5 inline-flex text-sm font-semibold text-foreground hover:underline"
          >
            {status?.policy_signed ? "Edit policy →" : "Sign policy →"}
          </Link>
        </section>

        <section className="surface-card p-6 md:p-8 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-lavender">
              <MessageCircle className="h-4 w-4" />
            </span>
            Telegram operator
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Start the Oscorp bot, send your User ID, then use{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">/run</code> for
            drafts with Post · Regenerate · Skip.
          </p>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex-1 rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your User ID
              </p>
              <code className="mt-2 block break-all font-mono text-xs leading-relaxed">
                {userId}
              </code>
              <p className="mt-3 font-mono text-xs text-muted-foreground">/link {userId}</p>
            </div>
            <button
              type="button"
              onClick={() => void copyId()}
              className="btn-primary inline-flex shrink-0 items-center gap-2 self-start px-5 py-2.5 text-sm"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy ID"}
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted/30 px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 text-sm font-medium ${mono ? "break-all font-mono text-xs" : ""}`}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function PolicyField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white px-4 py-3">
      <dt className="text-[10px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value ?? "—"}</dd>
    </div>
  );
}
