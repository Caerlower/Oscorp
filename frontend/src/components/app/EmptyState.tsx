import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-grad-lavender">
        <Icon className="h-7 w-7 text-foreground/50" />
      </div>
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="btn-primary mt-6 px-5 py-2.5 text-sm">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
