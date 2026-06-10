import { type ReactNode } from "react";
import { ResizableAgentColumn } from "@/components/mission-control/ResizableAgentColumn";
import { BottomStatusBar } from "@/components/mission-control/BottomStatusBar";
import { CompanyIntelDrawer } from "@/components/mission-control/CompanyIntelDrawer";
import { CmoChatDrawer } from "@/components/mission-control/CmoChatDrawer";
import { TerminalStrip } from "@/components/mission-control/TerminalStrip";
import { TopBar } from "@/components/mission-control/TopBar";

export function MissionControlShell({
  company,
  site,
  companyOpen,
  chatOpen,
  agentsActive,
  tasksReady,
  lastRunLabel,
  onToggleCompany,
  onToggleChat,
  onCloseCompany,
  onCloseChat,
  agentColumn,
  analyticsColumn,
}: {
  company: string;
  site: string;
  companyOpen: boolean;
  chatOpen: boolean;
  agentsActive: number;
  tasksReady: number;
  lastRunLabel: string;
  onToggleCompany: () => void;
  onToggleChat: () => void;
  onCloseCompany: () => void;
  onCloseChat: () => void;
  agentColumn: ReactNode;
  analyticsColumn: ReactNode;
}) {
  return (
    <div className="mc-shell flex h-screen flex-col overflow-hidden bg-background">
      <TopBar
        company={company}
        companyOpen={companyOpen}
        chatOpen={chatOpen}
        agentCount={agentsActive}
        onToggleCompany={onToggleCompany}
        onToggleChat={onToggleChat}
      />

      <TerminalStrip
        site={site}
        agentsActive={agentsActive}
        tasksReady={tasksReady}
        lastRunLabel={lastRunLabel}
      />

      <div className="mc-main-grid flex min-h-0 w-full flex-1 flex-row">
        <ResizableAgentColumn>{agentColumn}</ResizableAgentColumn>
        <main className="mc-analytics-column flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {analyticsColumn}
        </main>
      </div>

      <BottomStatusBar />

      <CompanyIntelDrawer
        open={companyOpen}
        company={company}
        site={site}
        onClose={onCloseCompany}
      />
      <CmoChatDrawer open={chatOpen} company={company} site={site} onClose={onCloseChat} />
    </div>
  );
}
