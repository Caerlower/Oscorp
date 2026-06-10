import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type DetailParams = Record<string, string | undefined>;

type DashboardDetailContextValue = {
  detailId: string | null;
  params: DetailParams;
  openDetail: (id: string, params?: DetailParams) => void;
  closeDetail: () => void;
};

const DashboardDetailContext = createContext<DashboardDetailContextValue | null>(null);

export function DashboardDetailProvider({ children }: { children: ReactNode }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [params, setParams] = useState<DetailParams>({});

  const openDetail = useCallback((id: string, nextParams?: DetailParams) => {
    setDetailId(id);
    setParams(nextParams ?? {});
  }, []);

  const closeDetail = useCallback(() => {
    setDetailId(null);
    setParams({});
  }, []);

  const value = useMemo(
    () => ({ detailId, params, openDetail, closeDetail }),
    [detailId, params, openDetail, closeDetail],
  );

  return (
    <DashboardDetailContext.Provider value={value}>{children}</DashboardDetailContext.Provider>
  );
}

export function useDashboardDetail() {
  const ctx = useContext(DashboardDetailContext);
  if (!ctx) {
    throw new Error("useDashboardDetail must be used within DashboardDetailProvider");
  }
  return ctx;
}
