import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, Shield } from "lucide-react";
import { useWallet } from "@txnlab/use-wallet-react";
import { ScopeType } from "@txnlab/use-wallet";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useSession } from "@/context/SessionContext";
import { api } from "@/lib/api";
import { policyMessage, microToUsd } from "@/lib/algorand";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Growth policy · Oscorp" }],
  }),
  component: OnboardingPage,
});

const defaultPolicy = {
  x_handle: "@founder",
  niche: "AI startups",
  growth_goal: "Attract founders and investors on X",
  tone: "technical but casual",
  posts_per_day: 2,
  auto_post: false,
  spend_cap_micro_usdc: 500_000,
  recent_posts: [] as string[],
};

function OnboardingPage() {
  const navigate = useNavigate();
  const { userId, walletAddress, refresh } = useSession();
  const { activeAccount, activeWallet, signData } = useWallet();
  const [policy, setPolicy] = useState(defaultPolicy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signAndContinue = async () => {
    if (!userId || !walletAddress) {
      setError("Connect your Algorand wallet first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const bytes = policyMessage(policy);
      let signature: string;
      if (activeWallet?.canSignData) {
        const dataB64 = btoa(String.fromCharCode(...bytes));
        const signed = await signData(dataB64, { scope: ScopeType.AUTH, encoding: "base64" });
        signature = btoa(String.fromCharCode(...signed.signature));
      } else {
        // Web3Auth / Defly / Lute: wallet signData not available — record wallet acknowledgment
        signature = `ack:${walletAddress}:${Date.now()}`;
      }
      await api.signPolicy(userId, policy, signature);
      await refresh();
      navigate({ to: "/agent" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign policy");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Step 1 of 2"
        title="Your growth policy"
        subtitle="Define how Oscorp researches, drafts, and spends via x402. You sign this before funding the agent."
        action={<ConnectWalletButton />}
      />

      {!walletAddress && (
        <div className="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          Connect an Algorand TestNet wallet to continue.
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface-card max-w-2xl space-y-5 p-8"
      >
        <Field label="X handle">
          <input
            className="field-input"
            value={policy.x_handle}
            onChange={(e) => setPolicy({ ...policy, x_handle: e.target.value })}
          />
        </Field>
        <Field label="Niche">
          <input
            className="field-input"
            value={policy.niche}
            onChange={(e) => setPolicy({ ...policy, niche: e.target.value })}
          />
        </Field>
        <Field label="Growth goal">
          <textarea
            className="field-input min-h-20"
            value={policy.growth_goal}
            onChange={(e) => setPolicy({ ...policy, growth_goal: e.target.value })}
          />
        </Field>
        <Field label="Tone">
          <input
            className="field-input"
            value={policy.tone}
            onChange={(e) => setPolicy({ ...policy, tone: e.target.value })}
          />
        </Field>
        <Field label={`Agent spend cap (USDC) — ${microToUsd(policy.spend_cap_micro_usdc)}`}>
          <input
            type="range"
            min={100_000}
            max={5_000_000}
            step={50_000}
            value={policy.spend_cap_micro_usdc}
            onChange={(e) =>
              setPolicy({ ...policy, spend_cap_micro_usdc: Number(e.target.value) })
            }
            className="w-full"
          />
        </Field>

        <label className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
          <input
            type="checkbox"
            checked={!policy.auto_post}
            onChange={() => setPolicy({ ...policy, auto_post: false })}
            className="mt-1"
          />
          <span>
            <strong className="font-medium">Human approval required</strong> — Oscorp never
            auto-posts. You publish via X intent links.
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={busy || !activeAccount}
          onClick={() => void signAndContinue()}
          className="btn-primary w-full disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          {busy ? "Signing…" : "Sign policy & continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
