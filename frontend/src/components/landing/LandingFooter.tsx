import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-white/60">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI growth operator for X. Research, draft, and pay providers with your
              agent wallet on Algorand TestNet.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Product
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#features" className="text-foreground/80 hover:text-foreground">
                  Features
                </a>
              </li>
              <li>
                <a href="#how" className="text-foreground/80 hover:text-foreground">
                  How it works
                </a>
              </li>
              <li>
                <a href="#x402" className="text-foreground/80 hover:text-foreground">
                  x402 payments
                </a>
              </li>
              <li>
                <Link to="/auth" className="text-foreground/80 hover:text-foreground">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Built with
            </p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>Groq · draft & research</li>
              <li>Algorand · TestNet USDC</li>
              <li>x402 · micropayments</li>
              <li>Telegram · daily copilot</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Oscorp</span>
          <span>Human-in-the-loop · No auto-posting</span>
        </div>
      </div>
    </footer>
  );
}
