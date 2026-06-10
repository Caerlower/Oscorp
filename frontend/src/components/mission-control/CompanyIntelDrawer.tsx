import { X } from "lucide-react";
import { CompanyPanel } from "@/components/dashboard/company-panel";
import { OverlayDrawer } from "@/components/mission-control/OverlayDrawer";

export function CompanyIntelDrawer({
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
      side="left"
      width={360}
      onClose={onClose}
      ariaLabel="Company Intel"
      surface="elevated"
    >
      <div className="mc-company-drawer flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-start justify-between border-b border-border px-4 pb-3 pt-4">
          <span className="mc-section-label">Company Intel</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close company panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <CompanyPanel
            company={company}
            site={site}
            minimized={false}
            onMinimizedChange={() => {}}
            embedded
            onClose={onClose}
          />
        </div>
      </div>
    </OverlayDrawer>
  );
}
