import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { pickPreferredAnalysis } from "@/types/analysis-types";
import {
  applyWorkspaceToLocal,
  collectLocalWorkspace,
  fetchRemoteWorkspace,
  hasRemoteWorkspace,
  hasWorkspaceContent,
  mergeWorkspacePatches,
  pushRemoteWorkspace,
  type WorkspacePatch,
} from "@/services/workspace-sync";

type WorkspaceContextValue = {
  ready: boolean;
  userId: string | null;
  site: string;
  schedulePersist: (patch: WorkspacePatch) => void;
  flushPersist: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const PERSIST_DEBOUNCE_MS = 1200;

export function WorkspaceProvider({
  userId,
  site,
  children,
}: {
  userId: string | null;
  site: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(() => !userId);
  const pendingRef = useRef<WorkspacePatch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const flushPersist = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid || !site.trim()) return;
    const patch = pendingRef.current;
    if (!hasWorkspaceContent(patch)) return;
    pendingRef.current = {};
    await pushRemoteWorkspace(uid, site, patch);
  }, [site]);

  const schedulePersist = useCallback(
    (patch: WorkspacePatch) => {
      pendingRef.current = mergeWorkspacePatches(pendingRef.current, patch);
      if (!userIdRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void flushPersist();
      }, PERSIST_DEBOUNCE_MS);
    },
    [flushPersist],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flushPersist();
    };
  }, [flushPersist]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!userId || !site.trim()) {
        setReady(true);
        return;
      }

      setReady(false);
      const local = collectLocalWorkspace(site);
      const remote = await fetchRemoteWorkspace(userId, site);

      if (cancelled) return;

      if (remote && hasRemoteWorkspace(remote)) {
        const preferredAnalysis = pickPreferredAnalysis(local.analysis, remote.analysis);
        applyWorkspaceToLocal(site, {
          analysis: preferredAnalysis ?? remote.analysis,
          company_profile: remote.company_profile as WorkspacePatch["company_profile"],
          edited_documents: remote.edited_documents,
          chat_active_messages: remote.chat_active_messages,
          chat_archived_sessions: remote.chat_archived_sessions,
        });
      } else if (hasWorkspaceContent(local)) {
        await pushRemoteWorkspace(userId, site, local);
      }

      if (!cancelled) setReady(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [userId, site]);

  const value = useMemo(
    () => ({
      ready,
      userId,
      site,
      schedulePersist,
      flushPersist,
    }),
    [ready, userId, site, schedulePersist, flushPersist],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    return {
      ready: true,
      userId: null,
      site: "",
      schedulePersist: () => {},
      flushPersist: async () => {},
    };
  }
  return ctx;
}
