import { Link, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Globe,
  History,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type SettingsSection } from "@/components/settings";
import { useSession } from "@/context/SessionContext";
import { useTheme } from "@/context/ThemeContext";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { useWalletConnect } from "@/hooks/useWalletConnect";
import { useProfileIdentity } from "@/hooks/useProfileIdentity";
import { formatUsdcDisplay, useWalletUsdcBalances } from "@/hooks/useWalletUsdcBalances";
import { readStoredSite, siteLabel } from "@/utils/navigation";

function Avatar({
  name,
  image,
  size = "sm",
  ring,
}: {
  name: string;
  image?: string | null;
  size?: "sm" | "lg";
  ring?: boolean;
}) {
  const dim = size === "lg" ? "h-10 w-10 text-sm" : "h-6 w-6 text-[10px]";
  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={`shrink-0 rounded-full object-cover ${dim} ${ring ? "oscorp-avatar-ring" : ""}`}
      />
    );
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
      : parts.length === 1
        ? parts[0]!.slice(0, 2).toUpperCase()
        : "OP";

  return (
    <div
      className={`mc-company-avatar flex shrink-0 items-center justify-center rounded-full font-bold text-white ${dim} ${ring ? "oscorp-avatar-ring" : ""}`}
    >
      {initials}
    </div>
  );
}

export function ProfileMenu({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const navigate = useNavigate();
  const { disconnect } = useWalletConnect();
  const { isOscorp } = useTheme();
  const identity = useProfileIdentity();
  const { agentUsdc, loading, error } = useWalletUsdcBalances();
  const isLight = variant === "light";
  const agentBalance = formatUsdcDisplay(agentUsdc, loading, error);

  const logout = async () => {
    await disconnect();
    navigate({ to: "/" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
            isLight
              ? "border-border bg-muted/50 hover:bg-muted"
              : "border-white/10 bg-white/5 hover:bg-white/10"
          }`}
        >
          <Avatar name={identity.name} image={identity.profileImage} ring={isOscorp} />
          <ChevronDown className={`h-3 w-3 shrink-0 ${isLight ? "text-muted-foreground" : "text-neutral-400"}`} />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="mc-profile-menu w-[280px] rounded-xl border border-border bg-secondary p-0 shadow-none">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={identity.name} image={identity.profileImage} size="lg" ring={isOscorp} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold text-foreground">{identity.name}</p>
              {identity.email ? (
                <p className="truncate text-xs text-muted-foreground">{identity.email}</p>
              ) : null}
              <span className="mc-agent-balance-pill mt-2 inline-flex text-[10px] font-medium text-primary">
                Agent wallet: {agentBalance}
              </span>
            </div>
          </div>
        </div>

        <div className="border-b border-border px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Theme</p>
          <ThemeSwitch compact />
        </div>

        <div className="py-1">
          <MenuSectionLabel>Workspace</MenuSectionLabel>
          <MenuLink to="/settings" section="websites" label="My Websites" icon={Globe} />
          <MenuLink to="/dashboard" search={{ url: undefined }} label="Analytics" icon={BarChart3} />
          <MenuLink to="/settings" section="transactions" label="Agent History" icon={History} />
        </div>

        <div className="border-t border-border py-1">
          <MenuSectionLabel>Account</MenuSectionLabel>
          <MenuLink to="/settings" section="payments" label="Wallet & Payments" icon={CreditCard} />
          <MenuLink to="/settings" label="Settings" icon={Settings} />
        </div>

        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex h-10 w-full items-center gap-3 px-4 text-sm font-medium text-red-600 transition hover:bg-muted/50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </p>
  );
}

function MenuLink({
  to,
  section,
  search,
  label,
  icon: Icon,
}: {
  to: string;
  section?: SettingsSection;
  search?: Record<string, unknown>;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      search={section ? { section } : search}
      className="flex h-10 items-center gap-3 px-4 text-sm text-foreground transition hover:bg-muted/50"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

/** Minimal dark strip for inner app pages — nav lives in ProfileMenu. */
export function OscorpTopBar({ company }: { company?: string }) {
  const { isOscorp } = useTheme();
  const { walletAddress } = useSession();
  const label = company ?? siteLabel(readStoredSite(walletAddress) ?? undefined);

  return (
    <div className={`border-b text-neutral-200 ${isOscorp ? "oscorp-topbar" : "border-white/10"}`}>
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
        <p className="truncate text-sm font-medium text-neutral-300">{label}</p>
        <ProfileMenu />
      </div>
    </div>
  );
}

/** App shell for setup/management pages — same chrome as the dashboard. */
export function OscorpChrome({
  children,
  company,
}: {
  children: ReactNode;
  company?: string;
}) {
  const { isOscorp } = useTheme();

  return (
    <div className={`min-h-screen ${isOscorp ? "oscorp-terminal-zone" : "bg-[#0d0d0e]"}`}>
      <OscorpTopBar company={company} />
      <div className="min-h-[calc(100vh-3.5rem)] rounded-t-3xl bg-background oscorp-chrome-shell">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
