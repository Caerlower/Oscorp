import { X } from "lucide-react";
import { ChatPanel } from "@/components/dashboard/ChatPanel";
import { OverlayDrawer } from "@/components/mission-control/OverlayDrawer";

export function CmoChatDrawer({
  open,
  company,
  site,
  onClose,
}: {
  open: boolean;
  company: string;
  site: string;
  onClose: () => void;
}) {
  return (
    <OverlayDrawer
      open={open}
      side="right"
      width={400}
      onClose={onClose}
      ariaLabel="AI CMO Chat"
      surface="elevated"
    >
      <div className="mc-chat-drawer flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-secondary">
        <ChatPanel company={company} site={site} drawerMode onClose={onClose} onMinimize={onClose} />
      </div>
    </OverlayDrawer>
  );
}
