import { Link } from "@tanstack/react-router";
import { CreditCard, Globe, Hexagon, History, Sparkles, User, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/utils";

export const SETTINGS_SECTIONS = [
  "websites",
  "personalization",
  "payments",
  "transactions",
  "account",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function parseSettingsSection(raw?: string): SettingsSection {
  if (raw && (SETTINGS_SECTIONS as readonly string[]).includes(raw)) {
    return raw as SettingsSection;
  }
  return "websites";
}

type SettingsNavItem = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
};

type SettingsNavGroup = {
  title: string;
  items: SettingsNavItem[];
};

const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    title: "Workspace",
    items: [
      { id: "websites", label: "Websites", icon: Globe },
      { id: "personalization", label: "Personalization", icon: Sparkles },
    ],
  },
  {
    title: "Billing",
    items: [
      { id: "payments", label: "Wallet & Payments", icon: CreditCard },
      { id: "transactions", label: "Transaction History", icon: History },
    ],
  },
  {
    title: "Account",
    items: [{ id: "account", label: "Account & Security", icon: User }],
  },
];

export function SettingsShell({
  section,
  children,
}: {
  section: SettingsSection;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-background">
      <aside className="mc-settings-sidebar flex h-full w-[240px] shrink-0 flex-col overflow-y-auto border-r border-border bg-secondary">
        <div className="border-b border-border px-4 py-4">
          <Link
            to="/dashboard"
            search={{ url: undefined }}
            className="inline-flex items-center gap-2 font-display text-sm font-bold tracking-[0.2em] text-foreground transition hover:opacity-80"
          >
            <Hexagon className="h-5 w-5 text-primary" strokeWidth={2.25} />
            OSCORP
          </Link>
        </div>

        <p className="px-4 pb-2 pt-6 font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </p>

        <nav className="flex-1 px-2 pb-6">
          {SETTINGS_NAV.map((group) => (
            <div key={group.title} className="mb-4">
              <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {group.title}
              </p>
              <ul>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <li key={item.id}>
                      <Link
                        to="/settings"
                        search={{ section: item.id }}
                        className={cn(
                          "mc-settings-nav-item flex h-10 items-center gap-3 px-4 text-sm transition",
                          active
                            ? "border-l-[3px] border-primary bg-primary/10 font-medium text-primary"
                            : "border-l-[3px] border-transparent text-foreground hover:bg-muted/50",
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className="mc-settings-content h-full min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain bg-background">
        <div className="mx-auto max-w-3xl px-8 py-8 pb-12">{children}</div>
      </main>
    </div>
  );
}
