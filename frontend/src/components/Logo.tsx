import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/oscorp-mark.svg"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0"
        draggable={false}
      />
      <span className="text-lg font-semibold tracking-tight text-foreground">Oscorp</span>
    </Link>
  );
}
