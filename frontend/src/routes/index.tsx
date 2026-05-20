import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  TrendingUp,
  MessageCircle,
  Clock,
  Check,
  Wallet,
  Shield,
  Zap,
  FileText,
  Bot,
  ChevronDown,
  Coins,
  LineChart,
} from "lucide-react";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { useSessionRedirect } from "@/hooks/useSessionRedirect";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { isSignedIn, homePath } = useSessionRedirect();
  const primaryCta = isSignedIn ? homePath : "/auth";
  const primaryLabel = isSignedIn ? "Open dashboard" : "Get started free";

  return (
    <div className="relative min-h-screen bg-aurora">
      <LandingNav />

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Private beta on Algorand TestNet
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl lg:text-[3.5rem] lg:leading-[1.08]"
            >
              Your AI growth{" "}
              <span className="bg-gradient-to-r from-[oklch(0.55_0.15_295)] via-[oklch(0.58_0.13_230)] to-[oklch(0.55_0.13_165)] bg-clip-text text-transparent">
                operator
              </span>{" "}
              for X.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-6 max-w-lg text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              Oscorp researches what to post, buys trend & hook intelligence via x402,
              drafts in your voice, and leaves you one tap from publishing — wallet and
              policy always in your control.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                to={primaryCta}
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm shadow-float"
              >
                <span>{primaryLabel}</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
              <a href="#how" className="btn-secondary inline-flex items-center gap-2 px-6 py-3 text-sm">
                See how it works
              </a>
            </motion.div>

            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No credit card", "TestNet USDC", "You approve every post"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border/60 bg-white/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6 text-center text-sm text-muted-foreground">
          {["Algorand TestNet", "x402 micropayments", "Groq drafts", "Telegram /run"].map(
            (label) => (
              <span key={label} className="font-medium tracking-tight text-foreground/70">
                {label}
              </span>
            ),
          )}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <SectionHeading
          eyebrow="Features"
          title="Everything a founder needs to show up on X"
          subtitle="Research, paid specialist APIs, drafts, and receipts — without juggling five tools."
        />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.05} />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white/55 py-24 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="How it works"
            title="From wallet to draft in minutes"
            subtitle="Connect once, set your growth policy, fund a small agent wallet, then run cycles on web or Telegram."
          />
          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative"
              >
                <span className="text-5xl font-semibold text-foreground/10">{step.n}</span>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* x402 */}
      <section id="x402" className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="surface-card overflow-hidden p-8 md:p-12 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">x402 on Algorand</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Your agent pays providers. You see every cent.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Each growth cycle can call a trend analyzer and hook generator (~$0.01 USDC
              each on TestNet). Payments settle from your agent wallet with on-chain tx
              links on every draft.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Signed spend cap in your growth policy",
                "Regenerate drafts without paying again",
                "Full receipt breakdown per cycle",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Coins className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-10 lg:mt-0 rounded-2xl bg-muted/40 p-6 ring-1 ring-border">
            <p className="text-xs font-medium text-muted-foreground">Example cycle spend</p>
            <div className="mt-4 space-y-3">
              <ReceiptRow label="Trend analyzer" amount="$0.01" />
              <ReceiptRow label="Hook generator" amount="$0.01" />
              <ReceiptRow label="Groq draft" amount="included" />
            </div>
            <p className="mt-4 text-sm font-medium">Total ≈ $0.02 USDC · TestNet</p>
          </div>
        </div>
      </section>

      {/* Telegram */}
      <section className="bg-white/55 py-24 md:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="order-2 lg:order-1">
            <div className="surface-card max-w-md p-6">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-grad-lavender text-sm font-bold">
                  O
                </div>
                <div>
                  <p className="font-semibold">Oscorp</p>
                  <p className="text-xs text-muted-foreground">bot</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <p className="rounded-2xl rounded-bl-md bg-muted px-3 py-2">
                  📈 Top topic today: AI infra distribution. Run /run?
                </p>
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[oklch(0.28_0.03_270)] px-3 py-2 text-white">
                  /run
                </p>
                <p className="rounded-2xl rounded-bl-md bg-muted px-3 py-2">
                  Draft ready — Post · Regenerate · Skip
                </p>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <SectionHeading
              eyebrow="Telegram"
              title="Run growth from chat"
              subtitle="Link your account once. Use /run for cycles, chat to teach niche and tone, get drafts with action buttons."
              align="left"
            />
            <Link to="/auth" className="btn-primary mt-8 inline-flex items-center gap-2">
              Connect & link Telegram
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Control */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <SectionHeading
          eyebrow="Control"
          title="You stay in the loop"
          subtitle="Oscorp never auto-posts. Every publish goes through you."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { icon: Shield, title: "Signed policy", body: "Niche, tone, spend cap — committed on-chain from your wallet." },
            { icon: FileText, title: "Draft queue", body: "Review reasoning, x402 receipts, and open posts in X when ready." },
            { icon: LineChart, title: "Groq research", body: "Topics rotate each cycle using memory and prior drafts." },
          ].map((item) => (
            <div key={item.title} className="surface-card p-6">
              <item.icon className="h-8 w-8 text-primary/80" />
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white/55 py-24 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple while we're in beta"
            subtitle="You bring TestNet ALGO & USDC for the agent wallet. Groq usage is included in dev."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <PricingCard
              name="Beta"
              price="Free"
              period="during private beta"
              highlighted
              features={[
                "Unlimited growth cycles (fair use)",
                "Telegram copilot",
                "x402 provider calls at ~$0.02/cycle",
                "Draft queue + regenerate",
              ]}
              cta={primaryLabel}
              ctaTo={primaryCta}
            />
            <PricingCard
              name="Pro"
              price="Soon"
              period="after beta"
              features={[
                "Scheduled daily drafts",
                "Deeper X research integrations",
                "Team workspaces",
                "Mainnet USDC when ready",
              ]}
              cta="Join waitlist"
              ctaTo="/auth"
              muted
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <SectionHeading eyebrow="FAQ" title="Common questions" />
        <div className="mt-12 mx-auto max-w-2xl divide-y divide-border rounded-2xl border border-border bg-white">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {item.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="rounded-[2rem] bg-[oklch(0.28_0.03_270)] px-8 py-14 text-center text-white md:px-16 md:py-20">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Ready to grow on X without the grind?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-white/70">
            Connect your wallet, fund your agent, and run your first cycle in under five minutes.
          </p>
          <Link
            to={primaryCta}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-[oklch(0.28_0.03_270)] transition hover:bg-white/90"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

const FEATURES = [
  { icon: Sparkles, tint: "bg-grad-lavender", title: "Groq research", copy: "Topics and angles from your niche, policy, and chat memory — before each cycle." },
  { icon: Zap, tint: "bg-grad-mint", title: "x402 providers", copy: "Trend analyzer and hook generator paid per call from your agent wallet." },
  { icon: Bot, tint: "bg-grad-peach", title: "Draft generation", copy: "On-brand posts with reasoning and a one-tap X intent link." },
  { icon: MessageCircle, tint: "bg-grad-lavender", title: "Telegram copilot", copy: "/run, Regenerate, Skip — same drafts as the web app." },
  { icon: Wallet, tint: "bg-grad-mint", title: "Agent wallet", copy: "Separate TestNet wallet for micropayments — you control the cap." },
  { icon: TrendingUp, tint: "bg-grad-peach", title: "Human in the loop", copy: "Nothing posts without you. Review, edit, publish when it feels right." },
];

const STEPS = [
  { n: "01", title: "Connect wallet", body: "Pera, Defly, Lute, or email via embedded wallet. We create your Oscorp account." },
  { n: "02", title: "Sign policy", body: "Set niche, tone, X handle, and USDC spend cap for the agent." },
  { n: "03", title: "Fund agent", body: "Send TestNet ALGO + USDC to the agent wallet for x402 fees." },
  { n: "04", title: "Run cycles", body: "Web dashboard or Telegram /run — drafts land in your queue." },
];

const FAQ = [
  { q: "Does Oscorp post automatically?", a: "No. Every post opens in X via an intent URL. You publish manually." },
  { q: "What does a cycle cost?", a: "About $0.02 USDC on TestNet for trend + hook providers, plus negligible ALGO for fees. Groq draft is included in beta." },
  { q: "Do I need xAI or live X API?", a: "No. Research uses Groq from your profile and memory. Live X integrations may come later." },
  { q: "Can I use only Telegram?", a: "You still connect a wallet on the web once for policy and funding. After that, /run works from Telegram." },
];

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const cn = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <div className={`max-w-2xl ${cn}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {subtitle && (
        <p className="mt-3 text-muted-foreground leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  tint,
  title,
  copy,
  delay,
}: {
  icon: typeof Sparkles;
  tint: string;
  title: string;
  copy: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="surface-card p-6 transition hover:shadow-float"
    >
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${tint}`}>
        <Icon className="h-5 w-5 text-foreground/70" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>
    </motion.div>
  );
}

function ReceiptRow({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{amount}</span>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  features,
  cta,
  ctaTo,
  highlighted,
  muted,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  ctaTo: string;
  highlighted?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-8 ring-1 ${
        highlighted
          ? "bg-[oklch(0.28_0.03_270)] text-white ring-transparent"
          : "surface-card"
      }`}
    >
      <p className={`text-sm font-medium ${highlighted ? "text-white/70" : "text-muted-foreground"}`}>
        {name}
      </p>
      <p className="mt-2 text-4xl font-semibold">{price}</p>
      <p className={`text-sm ${highlighted ? "text-white/60" : "text-muted-foreground"}`}>{period}</p>
      <ul className={`mt-6 space-y-3 text-sm ${highlighted ? "text-white/85" : "text-muted-foreground"}`}>
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className={`h-4 w-4 shrink-0 ${highlighted ? "text-emerald-300" : "text-emerald-600"}`} />
            {f}
          </li>
        ))}
      </ul>
      <Link
        to={ctaTo}
        className={
          highlighted
            ? "mt-8 inline-flex w-full items-center justify-center rounded-full bg-white py-3 text-sm font-semibold text-[oklch(0.28_0.03_270)]"
            : muted
              ? "btn-secondary mt-8 w-full pointer-events-none opacity-60"
              : "btn-primary mt-8 w-full"
        }
      >
        {cta}
      </Link>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto h-[480px] w-full max-w-md lg:h-[520px]">
      <div className="absolute inset-0 -z-10 blur-3xl">
        <div className="absolute left-10 top-10 h-52 w-52 rounded-full bg-[oklch(0.85_0.12_295)] opacity-45" />
        <div className="absolute right-0 top-28 h-52 w-52 rounded-full bg-[oklch(0.85_0.12_230)] opacity-45" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="absolute left-0 top-0 w-[78%] surface-card p-5 shadow-float"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-grad-lavender text-sm font-semibold">
            O
          </div>
          <div>
            <p className="text-sm font-semibold">Oscorp</p>
            <p className="text-[11px] text-muted-foreground">Groq research</p>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <ChatBubble delay={0.5}>📈 AI startup chatter up 31% today.</ChatBubble>
          <ChatBubble delay={0.9}>I drafted 2 hooks. Want to peek?</ChatBubble>
          <ChatBubble delay={1.2} self>
            yes
          </ChatBubble>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="absolute right-0 top-40 w-[72%] animate-float surface-card p-5 shadow-float"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-grad-mint/80 px-2 py-0.5 text-[10px] font-medium">
            <Sparkles className="h-3 w-3" /> Draft
          </span>
          <span className="text-[11px] text-muted-foreground">2:14 PM</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed">
          “Most AI startups are rebuilding SaaS badly — here's the playbook that actually compounds.”
        </p>
        <p className="mt-3 text-xs text-emerald-600 font-medium">Paid via x402 · $0.02</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="absolute bottom-4 left-6 w-[58%] surface-card p-4 shadow-float"
      >
        <p className="text-xs text-muted-foreground">Followers · 7d</p>
        <p className="text-xl font-semibold">+1,284</p>
        <Sparkline />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.1 }}
        className="absolute right-2 bottom-36 inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium shadow-soft"
      >
        <Clock className="h-3 w-3" /> Best window · 2 PM
      </motion.div>
    </div>
  );
}

function ChatBubble({
  children,
  delay,
  self,
}: {
  children: React.ReactNode;
  delay: number;
  self?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`flex ${self ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 ${
          self
            ? "rounded-br-md bg-[oklch(0.28_0.03_270)] text-white"
            : "rounded-bl-md bg-muted"
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}

function Sparkline() {
  const points = [12, 18, 14, 22, 19, 28, 26, 34, 30, 42];
  const w = 160;
  const h = 36;
  const max = Math.max(...points);
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (p / max) * h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-10 w-full">
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="oklch(0.85 0.12 295 / 0.35)" />
      <path d={d} fill="none" stroke="oklch(0.55 0.15 295)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
