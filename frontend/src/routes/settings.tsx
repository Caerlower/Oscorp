import { createFileRoute } from "@tanstack/react-router";
import { RequireSession } from "@/components/RequireSession";
import { SettingsShell, parseSettingsSection, type SettingsSection } from "@/components/settings";
import { WebsitesSection } from "@/components/settings/sections/WebsitesSection";
import { PersonalizationSection } from "@/components/settings/sections/PersonalizationSection";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import { PaymentsSection } from "@/components/settings/sections/PaymentsSection";
import { TransactionsSection } from "@/components/settings/sections/TransactionsSection";
export const Route = createFileRoute("/settings")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: parseSettingsSection(typeof search.section === "string" ? search.section : undefined),
  }),
  head: () => ({ meta: [{ title: "Settings · Oscorp" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { section } = Route.useSearch();

  return (
    <RequireSession>
      <SettingsShell section={section}>
        <SettingsSectionContent section={section} />
      </SettingsShell>
    </RequireSession>
  );
}

function SettingsSectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "websites":
      return <WebsitesSection />;
    case "personalization":
      return <PersonalizationSection />;
    case "payments":
      return <PaymentsSection />;
    case "transactions":
      return <TransactionsSection />;
    case "account":
      return <AccountSection />;
    default:
      return <WebsitesSection />;
  }
}
