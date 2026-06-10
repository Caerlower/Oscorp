import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function OverlayDrawer({
  open,
  side,
  width,
  onClose,
  children,
  ariaLabel,
  surface = "default",
}: {
  open: boolean;
  side: "left" | "right";
  width: number;
  onClose: () => void;
  children: ReactNode;
  ariaLabel: string;
  surface?: "default" | "elevated";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="mc-drawer-root fixed inset-0 z-[180]">
      <button
        type="button"
        className={`mc-drawer-backdrop absolute inset-0 bg-black/40 ${
          surface === "elevated" ? "backdrop-blur-[4px]" : "backdrop-blur-[1px]"
        }`}
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`mc-drawer-panel absolute inset-y-0 flex flex-col border-border ${
          surface === "elevated" ? "mc-drawer-elevated bg-secondary" : "bg-background shadow-2xl"
        } ${side === "left" ? "left-0 border-r mc-drawer-left" : "right-0 border-l mc-drawer-right"}`}
        style={{ width: `min(${width}px, 100vw)` }}
      >
        {children}
      </aside>
    </div>,
    document.body,
  );
}
