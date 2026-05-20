import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  User,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { ConnectWalletButton } from "./ConnectWalletButton";
import { isProtectedPath } from "@/components/RequireSession";
import { useSession } from "@/context/SessionContext";
import { useState, type ReactNode } from "react";

const mainNav = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/drafts", label: "Drafts", icon: FileText },
  { to: "/agent", label: "Agent", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { userId } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {mainNav.map((item) => {
        const active =
          location.pathname === item.to ||
          location.pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-[oklch(0.28_0.03_270)] text-white shadow-soft"
                : "text-muted-foreground hover:bg-white hover:text-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white/90" : ""}`} />
            {item.label}
            {active && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            )}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen app-canvas">
      <div className="mx-auto flex max-w-[1280px] gap-5 px-4 py-5 md:gap-8 md:px-6 md:py-8">
        <aside className="sticky top-6 hidden h-[calc(100vh-2.5rem)] w-56 shrink-0 flex-col md:flex">
          <div className="surface-card flex flex-1 flex-col p-4 shadow-float">
            <Logo />
            <nav className="mt-6 flex flex-1 flex-col gap-1">
              <NavLinks />
            </nav>
            <div className="mt-auto space-y-2 border-t border-border/80 pt-4">
              <Link
                to="/settings"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  location.pathname === "/settings"
                    ? "bg-[oklch(0.28_0.03_270)] text-white shadow-soft"
                    : "text-muted-foreground hover:bg-white hover:text-foreground"
                }`}
              >
                <Settings
                  className={`h-4 w-4 shrink-0 ${
                    location.pathname === "/settings" ? "text-white/90" : ""
                  }`}
                />
                Settings
              </Link>
              <ConnectWalletButton variant="sidebar" />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 md:pb-0">
          <div className="mb-5 flex items-center justify-between gap-3 md:hidden">
            <Logo />
            <div className="flex items-center gap-2">
              <ConnectWalletButton />
              <button
                type="button"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileOpen((o) => !o)}
                className="rounded-xl border border-border bg-white p-2.5 shadow-soft"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <nav className="surface-card mb-5 flex flex-col gap-1 p-3 shadow-float md:hidden">
              <NavLinks onClick={() => setMobileOpen(false)} />
              <Link
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground"
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </nav>
          )}

          {!userId &&
            location.pathname !== "/auth" &&
            !location.pathname.startsWith("/auth/") &&
            !isProtectedPath(location.pathname) && (
              <div className="surface-card mb-6 flex items-center justify-between gap-3 px-5 py-4 text-sm">
                <span className="text-muted-foreground">Connect your wallet to use Oscorp.</span>
                <Link to="/auth" className="btn-primary shrink-0 px-4 py-2 text-xs">
                  Sign in
                </Link>
              </div>
            )}

          {children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-white/95 px-3 py-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg justify-around">
          {mainNav.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[10px] font-medium transition ${
                  active
                    ? "text-[oklch(0.28_0.03_270)]"
                    : "text-muted-foreground"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    active ? "bg-[oklch(0.28_0.03_270)] text-white" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
