import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">
            {eyebrow}
          </p>
        )}
        <h1
          className={`font-semibold tracking-tight text-foreground ${eyebrow ? "mt-1" : ""} text-2xl md:text-[1.75rem]`}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}
