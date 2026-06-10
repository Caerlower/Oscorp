import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const PANEL_RATIO_KEY = "oscorp-panel-split-ratio";
const DEFAULT_RATIO = 0.42;
const MIN_PANEL_PX = 320;
const MAX_RATIO = 0.55;

function minRatioForViewport(vw: number): number {
  return MIN_PANEL_PX / Math.max(vw, 1);
}

function clampRatio(ratio: number, vw: number): number {
  return Math.min(MAX_RATIO, Math.max(minRatioForViewport(vw), ratio));
}

function ratioToWidth(ratio: number, containerWidth: number): number {
  return Math.round(clampRatio(ratio, containerWidth) * containerWidth);
}

function readPanelRatio(): number {
  if (typeof window === "undefined") return DEFAULT_RATIO;
  try {
    const raw = localStorage.getItem(PANEL_RATIO_KEY);
    if (!raw) return DEFAULT_RATIO;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_RATIO;
    return clampRatio(parsed, window.innerWidth);
  } catch {
    return DEFAULT_RATIO;
  }
}

export function ResizableAgentColumn({ children }: { children: ReactNode }) {
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window === "undefined"
      ? Math.round(DEFAULT_RATIO * 1200)
      : ratioToWidth(readPanelRatio(), window.innerWidth),
  );
  const ratioRef = useRef(readPanelRatio());
  const containerRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const syncWidthFromContainer = useCallback(() => {
    const parent = containerRef.current?.parentElement;
    const containerWidth = parent?.getBoundingClientRect().width ?? window.innerWidth;
    setPanelWidth(ratioToWidth(ratioRef.current, containerWidth));
  }, []);

  useEffect(() => {
    syncWidthFromContainer();
    const onResize = () => syncWidthFromContainer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncWidthFromContainer]);

  const endDrag = useCallback(() => {
    if (dragRef.current) {
      const parent = containerRef.current?.parentElement;
      const containerWidth = parent?.getBoundingClientRect().width ?? window.innerWidth;
      if (containerWidth > 0) {
        ratioRef.current = clampRatio(panelWidth / containerWidth, containerWidth);
        localStorage.setItem(PANEL_RATIO_KEY, String(ratioRef.current));
      }
    }
    dragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const parent = containerRef.current?.parentElement;
      const containerWidth = parent?.getBoundingClientRect().width ?? window.innerWidth;
      const maxWidth = Math.round(containerWidth * MAX_RATIO);
      const next = Math.min(maxWidth, Math.max(MIN_PANEL_PX, drag.startWidth + (e.clientX - drag.startX)));
      setPanelWidth(next);
    };
    const onUp = () => endDrag();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [endDrag]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startWidth: panelWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  return (
    <aside
      ref={containerRef}
      className="mc-agent-column relative flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-border"
      style={{ width: panelWidth }}
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize agent panel"
        title="Drag to resize"
        onPointerDown={onPointerDown}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="mc-agent-resize-handle absolute top-0 z-20 h-full w-1.5 cursor-col-resize touch-none"
        style={{ right: -3 }}
      />
    </aside>
  );
}
