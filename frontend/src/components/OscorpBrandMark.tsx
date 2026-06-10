import { Link } from "@tanstack/react-router";
import { Hexagon } from "lucide-react";

type OscorpBrandMarkProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  linkTo?: "/" | false;
};

/** Hexagon + OSCORP wordmark — matches dashboard TopBar. */
export function OscorpBrandMark({
  className = "",
  iconClassName = "h-5 w-5",
  textClassName = "font-display text-lg font-bold tracking-[0.2em]",
  linkTo = "/",
}: OscorpBrandMarkProps) {
  const content = (
    <>
      <Hexagon className={`shrink-0 text-primary ${iconClassName}`} strokeWidth={2.25} aria-hidden />
      <span className={textClassName}>OSCORP</span>
    </>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className={`inline-flex items-center gap-2 ${className}`}>
        {content}
      </Link>
    );
  }

  return <div className={`inline-flex items-center gap-2 ${className}`}>{content}</div>;
}
