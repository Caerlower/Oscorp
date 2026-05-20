import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useSessionRedirect } from "@/hooks/useSessionRedirect";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#x402", label: "x402" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export function LandingNav() {
  const { isSignedIn, homePath } = useSessionRedirect();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-[oklch(0.992_0.005_80/0.85)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isSignedIn ? (
            <Link
              to={homePath}
              className="btn-primary inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-5 py-2.5 text-sm shadow-float"
            >
              <span>Go to app</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          ) : (
            <>
              <Link
                to="/auth"
                className="hidden text-sm font-medium text-foreground/80 transition hover:text-foreground sm:inline"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                className="btn-primary inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-5 py-2.5 text-sm shadow-float"
              >
                <span>Get started</span>
                <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
