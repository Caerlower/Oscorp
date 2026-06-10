import { Link } from "@tanstack/react-router";
import { OscorpBrandMark } from "@/components/OscorpBrandMark";
import { ProfileMenu } from "@/components/OscorpChrome";
import { useAuth } from "@/hooks/useAuth";

export function MarketingHeader() {
  const { phase } = useAuth();
  const authenticated = phase === "authenticated";
  const needsReconnect = phase === "needs_reconnect";

  const dashboardTo = authenticated
    ? { to: "/dashboard" as const, search: { url: undefined } }
    : needsReconnect
      ? { to: "/auth" as const, search: { redirect: "/dashboard" as const } }
      : { to: "/auth" as const, search: { redirect: "/dashboard" as const } };

  return (
    <header className="landing-nav">
      <div className="landing-nav-inner">
        <OscorpBrandMark
          iconClassName="h-6 w-6"
          textClassName="landing-nav-wordmark text-base tracking-[0.2em]"
        />
        <nav className="flex items-center gap-3">
          <Link {...dashboardTo} className="landing-btn-outline">
            Dashboard
          </Link>
          {authenticated ? <ProfileMenu variant="light" /> : null}
        </nav>
      </div>
    </header>
  );
}
