import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useSession } from "@/context/SessionContext";
import { User, Server, LogOut } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · Oscorp" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { clearSession } = useSession();
  const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Account shortcuts and developer info."
        action={<ConnectWalletButton />}
      />

      <div className="max-w-xl space-y-4">
        <section className="surface-card p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grad-lavender">
              <User className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">Account</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Wallet, policy, and Telegram are managed on Profile.
              </p>
              <Link to="/profile" className="btn-primary mt-4 inline-flex text-sm">
                Open profile
              </Link>
            </div>
          </div>
        </section>

        <section className="surface-card p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-grad-mint">
              <Server className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">API endpoint</h2>
              <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{apiUrl}</p>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={clearSession}
          className="surface-card flex w-full items-center justify-center gap-2 px-5 py-4 text-sm font-medium text-muted-foreground transition hover:border-destructive/30 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Clear local session
        </button>
      </div>
    </AppShell>
  );
}
