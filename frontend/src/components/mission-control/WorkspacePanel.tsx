import type { ReactNode } from "react";

export function WorkspacePanel({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mc-workspace-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="mc-section-label">{label}</span>
        {action ? <div className="flex items-center gap-1">{action}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
    </div>
  );
}
