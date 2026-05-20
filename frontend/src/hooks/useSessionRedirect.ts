import { useSession } from "@/context/SessionContext";
import { isSessionReady, sessionHomePath } from "@/lib/session-routes";

/** Auth-aware paths for landing / sign-in links. */
export function useSessionRedirect() {
  const { userId, status, loading } = useSession();
  const ready = isSessionReady(userId, status);
  const restoring = !!userId && loading && !status;

  return {
    userId,
    status,
    isSignedIn: ready,
    restoring,
    signInPath: ready ? sessionHomePath(status) : "/auth",
    homePath: ready ? sessionHomePath(status) : "/auth",
  };
}
