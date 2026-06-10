import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { OscorpChrome } from "@/components/OscorpChrome";
import { useAuth } from "@/hooks/useAuth";

export function RequireSession({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { phase } = useAuth();

  useEffect(() => {
    if (phase === "anonymous" || phase === "needs_reconnect") {
      navigate({
        to: "/auth",
        search: { redirect: location.pathname },
        replace: true,
      });
    }
  }, [phase, navigate, location.pathname]);

  if (phase === "booting" || phase === "restoring") {
    return (
      <OscorpChrome>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          {phase === "booting" ? "Loading…" : "Restoring your session…"}
        </div>
      </OscorpChrome>
    );
  }

  if (phase !== "authenticated") {
    return (
      <OscorpChrome>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          Redirecting to sign in…
        </div>
      </OscorpChrome>
    );
  }

  return <>{children}</>;
}
