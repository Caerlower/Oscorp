import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { DashboardDetailDrawer, DashboardDetailProvider } from "@/components/dashboard";
import { AgentsFeedPanel } from "@/components/dashboard/agents-panel";
import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";
import { MissionControlShell } from "@/components/mission-control/MissionControlShell";
import { AnalysisProvider, useAnalysis } from "@/context/AnalysisContext";
import { CompanyProfileProvider } from "@/context/CompanyProfileContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { useSession } from "@/context/SessionContext";
import { usePaymentUser } from "@/context/PaymentUserContext";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { RequireSession } from "@/components/RequireSession";
import { isValidSite, normalizeSiteUrl, readStoredSite, siteLabel } from "@/utils/navigation";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>) => ({
    url: typeof s.url === "string" ? s.url : undefined,
  }),
  head: () => ({ meta: [{ title: "AI CMO Terminal · Oscorp" }] }),
  component: Dashboard,
});

function resolveDashboardSite(
  walletAddress: string | null,
  searchUrl?: string,
  productSite?: string | null,
  override?: string | null,
): string | null {
  if (override && isValidSite(override)) {
    return normalizeSiteUrl(override);
  }
  if (searchUrl) {
    const fromSearch = normalizeSiteUrl(searchUrl);
    if (isValidSite(fromSearch)) return fromSearch;
  }
  if (productSite && isValidSite(productSite)) {
    return normalizeSiteUrl(productSite);
  }
  return readStoredSite(walletAddress);
}

function Dashboard() {
  const { url: searchUrl } = Route.useSearch();
  const { walletAddress } = useSession();
  const { user, ready: paymentReady } = usePaymentUser();
  const [companyOpen, setCompanyOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [siteOverride, setSiteOverride] = useState<string | null>(null);

  const site = useMemo(
    () => resolveDashboardSite(walletAddress, searchUrl, user?.product_site, siteOverride),
    [walletAddress, searchUrl, user?.product_site, siteOverride],
  );
  const company = siteLabel(site);

  useEffect(() => {
    setClientReady(true);
  }, []);

  if (!clientReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <RequireSession>
      <OnboardingGate onSiteSaved={setSiteOverride}>
        {site ? (
          <DashboardWorkspace site={site} company={company} companyOpen={companyOpen} setCompanyOpen={setCompanyOpen} chatOpen={chatOpen} setChatOpen={setChatOpen} />
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            {paymentReady ? "Preparing your workspace…" : "Loading your profile…"}
          </div>
        )}
      </OnboardingGate>
    </RequireSession>
  );
}

function DashboardWorkspace({
  site,
  company,
  companyOpen,
  setCompanyOpen,
  chatOpen,
  setChatOpen,
}: {
  site: string;
  company: string;
  companyOpen: boolean;
  setCompanyOpen: (open: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}) {
  const { user, ready } = usePaymentUser();

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  return (
    <WorkspaceProvider userId={user?.id ?? null} site={site}>
      <AnalysisProvider site={site}>
        <DashboardDetailProvider>
          <CompanyProfileProvider site={site} company={company}>
            <DashboardView
              site={site}
              company={company}
              companyOpen={companyOpen}
              setCompanyOpen={setCompanyOpen}
              chatOpen={chatOpen}
              setChatOpen={setChatOpen}
            />
          </CompanyProfileProvider>
        </DashboardDetailProvider>
      </AnalysisProvider>
    </WorkspaceProvider>
  );
}

function DashboardView({
  site,
  company,
  companyOpen,
  setCompanyOpen,
  chatOpen,
  setChatOpen,
}: {
  site: string;
  company: string;
  companyOpen: boolean;
  setCompanyOpen: (open: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}) {
  const analysisCtx = useAnalysis();
  const { data: analysis, status: analysisStatus } = analysisCtx;

  const agentsActive = 6;
  const tasksReady = useMemo(() => {
    const issues = analysis?.seo?.issues?.length ?? 0;
    const seoRecs = issues > 0 ? issues : 2;
    return seoRecs + 7;
  }, [analysis?.seo?.issues]);

  const lastRunLabel = useMemo(() => {
    if (analysisStatus === "loading") return "running…";
    if (analysisStatus === "live") return "2m ago";
    return "—";
  }, [analysisStatus]);

  return (
    <>
      <MissionControlShell
        company={company}
        site={site}
        companyOpen={companyOpen}
        chatOpen={chatOpen}
        agentsActive={agentsActive}
        tasksReady={tasksReady}
        lastRunLabel={lastRunLabel}
        onToggleCompany={() => setCompanyOpen(!companyOpen)}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onCloseCompany={() => setCompanyOpen(false)}
        onCloseChat={() => setChatOpen(false)}
        agentColumn={<AgentsFeedPanel company={company} site={site} />}
        analyticsColumn={<AnalyticsPanel />}
      />
      <DashboardDetailDrawer
        company={company}
        site={site}
        analysis={analysisCtx.data}
        updateDocument={analysisCtx.updateDocument}
      />
    </>
  );
}
