import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Zap } from "lucide-react";
import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { OscorpBrandMark } from "@/components/OscorpBrandMark";
import { ProfileMenu } from "@/components/OscorpChrome";
import { useAuth } from "@/hooks/useAuth";
import { isValidSite, normalizeSiteUrl, storePendingSite, storeSite } from "@/utils/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { agents, testimonials, pricingRows, faqs } from "@/constants/landing-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Oscorp — Meet your AI CMO" },
      {
        name: "description",
        content:
          "AI CMO terminal for founders. Analyze your website, fix SEO issues, and generate company marketing documents.",
      },
      { property: "og:title", content: "Oscorp — Meet your AI CMO" },
      {
        property: "og:description",
        content: "Website analysis, SEO, and AI-generated company docs in one dashboard.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="landing min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main>
        <Hero />
        <CommandCenter />
        <Testimonials />
        <Pricing />
        <FAQ />
      </main>

      <LandingFooter />
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  const { phase, walletAddress } = useAuth();
  const [url, setUrl] = useState("");

  const start = (site: string) => {
    const clean = normalizeSiteUrl(site);
    if (!isValidSite(clean)) return;
    if (phase === "authenticated" && walletAddress) {
      storeSite(clean, walletAddress);
    } else {
      storePendingSite(clean);
    }
    if (phase === "authenticated") {
      navigate({ to: "/dashboard", search: { url: undefined } });
      return;
    }
    navigate({
      to: "/auth",
      search: { redirect: "/dashboard" },
    });
  };

  return (
    <section className="landing-section landing-hero">
      <div className="landing-hero-glow" aria-hidden />
      <div className="landing-container relative z-[1] text-center">
        <div className="mb-8 flex justify-center">
          <span className="landing-hero-badge">
            ⚡ Powered by Algorand x402 · Agentic Commerce
          </span>
        </div>

        <h1 className="landing-hero-title text-foreground">
          Meet Oscorp, your{" "}
          <span className="landing-accent-text">AI CMO</span>
        </h1>

        <p className="landing-hero-subtext mx-auto mt-5 max-w-[560px]">
          Paste your URL. Get your full marketing strategy, SEO audit, competitor intel, and
          autonomous agents — in under 60 seconds.
        </p>

        <form
          className="mx-auto mt-10 max-w-[560px]"
          onSubmit={(e) => {
            e.preventDefault();
            start(url);
          }}
        >
          <div className="landing-url-form">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="www.yourcompany.com"
              className="landing-url-input"
            />
            <button type="submit" disabled={!url.trim()} className="landing-url-submit">
              Analyze site <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-4 text-center text-[13px] text-muted-foreground">
            Free SEO analysis · Agents from $0.02 · No subscription
          </p>
        </form>

        <LandingTerminalBand className="mt-12" />

        <div className="mt-10 flex flex-wrap justify-center gap-6">
          {agents.slice(0, 6).map((a) => (
            <div key={a.name} className="group flex w-[72px] flex-col items-center gap-2">
              <div
                className="landing-feature-icon landing-feature-icon--colored"
                style={{ backgroundColor: a.color }}
              >
                <a.icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-xs font-medium text-foreground/80">{a.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LandingTerminalBand({ className = "" }: { className?: string }) {
  return (
    <div className={`landing-terminal-band ${className}`}>
      <div className="landing-terminal-band-inner font-mono text-[11px] leading-relaxed sm:text-xs">
        <p>
          <span className="landing-terminal-prompt">{">"}</span> oscorp init --mode marketing
        </p>
        <p className="text-neutral-500">
          <span className="landing-terminal-prompt">{">"}</span> loading agents · seo · competitors ·
          x402 payments
          <span className="landing-terminal-cursor ml-0.5 inline-block h-3.5 w-1.5 align-middle" />
        </p>
      </div>
    </div>
  );
}

function CommandCenter() {
  return (
    <section className="landing-section landing-section-alt">
      <div className="landing-container">
        <p className="landing-section-label mb-4">The command center</p>
        <h2 className="landing-headline">
          Everything a marketing team researches, in one terminal.
        </h2>
        <p className="landing-hero-subtext mx-auto mt-4 max-w-2xl text-center text-base">
          Live today: company panel, analytics, and structured documents. Agent publishing previews
          are next.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <div key={a.name} className="landing-feature-card landing-surface group">
              <div
                className="landing-feature-icon landing-feature-icon--colored mb-4 h-12 w-12"
                style={{ backgroundColor: a.color }}
              >
                <a.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-display text-lg font-bold">{a.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="landing-section overflow-hidden">
      <div className="landing-container mb-12">
        <p className="landing-section-label mb-4">What our users say</p>
        <h2 className="landing-headline">Loved by builders and marketers.</h2>
      </div>

      <div className="landing-container hidden gap-5 md:grid md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <TestimonialCard key={t.name} testimonial={t} />
        ))}
      </div>

      <div className="landing-marquee-wrap md:hidden">
        <div className="landing-marquee-fade-left" aria-hidden />
        <div className="landing-marquee-fade-right" aria-hidden />
        <div className="overflow-hidden">
          <div className="flex shrink-0 animate-marquee gap-4 pr-4" style={{ animationDuration: "70s" }}>
            {[...testimonials, ...testimonials].map((t, idx) => (
              <TestimonialCard key={`${t.name}-${idx}`} testimonial={t} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial: t }: { testimonial: (typeof testimonials)[number] }) {
  const initial = t.name.trim().charAt(0).toUpperCase();

  return (
    <figure className="landing-testimonial-card landing-surface">
      <blockquote className="landing-testimonial-quote">{t.quote}</blockquote>
      <figcaption className="landing-testimonial-author">
        <span className="landing-testimonial-avatar" aria-hidden>
          {initial}
        </span>
        <span>
          <div className="font-display text-sm font-bold leading-tight">{t.name}</div>
          <div className="text-xs text-muted-foreground">{t.source}</div>
        </span>
      </figcaption>
    </figure>
  );
}

function Pricing() {
  return (
    <section className="landing-section">
      <div className="landing-container" style={{ maxWidth: 900 }}>
        <p className="landing-section-label mb-4">Compare the stack</p>
        <h2 className="landing-headline">
          What a CMO replaces vs. what{" "}
          <span className="landing-accent-text">Oscorp</span> covers
        </h2>

        <div className="landing-pricing-table landing-surface mt-12">
          <div className="landing-pricing-header">
            <div>What needs doing</div>
            <div className="landing-pricing-col-traditional text-right">Traditional</div>
            <div className="landing-pricing-col-oscorp landing-pricing-oscorp-label text-right">
              Oscorp
            </div>
          </div>
          {pricingRows.map(([what, without]) => (
            <div key={what} className="landing-pricing-row">
              <div>{what}</div>
              <div className="landing-pricing-col-traditional landing-pricing-traditional">
                {without}
              </div>
              <div className="landing-pricing-col-oscorp landing-pricing-check">
                <Check className="ml-auto h-[18px] w-[18px]" strokeWidth={2.5} />
              </div>
            </div>
          ))}
          <div className="landing-pricing-footer">
            <div>Typical monthly spend</div>
            <div className="landing-pricing-col-traditional landing-pricing-footer-traditional">
              $14,000+
            </div>
            <div className="landing-pricing-col-oscorp landing-pricing-footer-oscorp">
              Pay as you go · x402
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="landing-section">
      <div className="landing-container">
        <p className="landing-section-label mb-4">Got questions?</p>
        <h2 className="landing-headline mb-10">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="landing-faq w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="landing-accordion-trigger text-left">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="landing-accordion-content">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function LandingFooter() {
  const { phase } = useAuth();
  const authenticated = phase === "authenticated";
  const needsReconnect = phase === "needs_reconnect";

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <OscorpBrandMark
              linkTo={false}
              iconClassName="h-5 w-5"
              textClassName="font-display text-base font-bold tracking-[0.2em]"
            />
            <p className="mt-2 text-[13px] text-muted-foreground">Your autonomous AI CMO</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Built on Algorand · Powered by x402
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {authenticated ? (
              <>
                <Link to="/dashboard" search={{ url: undefined }} className="landing-footer-link">
                  Dashboard
                </Link>
                <ProfileMenu variant="light" />
              </>
            ) : needsReconnect ? (
              <Link
                to="/auth"
                search={{ redirect: "/dashboard" }}
                className="landing-footer-link"
              >
                Reconnect wallet
              </Link>
            ) : (
              <Link to="/auth" className="landing-footer-link">
                Sign in
              </Link>
            )}
            <a href="#faq" className="landing-footer-link">
              FAQ
            </a>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Oscorp
        </p>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Zap className="h-3 w-3" aria-hidden />
          Payments powered by Algorand x402
        </p>
      </div>
    </footer>
  );
}
