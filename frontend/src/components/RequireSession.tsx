import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/context/SessionContext";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/drafts",
  "/agent",
  "/profile",
  "/onboarding",
  "/settings",
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Redirects unsigned users to /auth and shows a loading shell while session restores.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, status, loading } = useSession();

  useEffect(() => {
    if (!userId && !loading) {
      navigate({
        to: "/auth",
        search: { redirect: location.pathname },
        replace: true,
      });
    }
  }, [userId, loading, navigate, location.pathname]);

  if (!userId) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          Redirecting to sign in…
        </div>
      </AppShell>
    );
  }

  if (loading && !status) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          Restoring your session…
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
