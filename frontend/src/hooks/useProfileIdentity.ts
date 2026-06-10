import { useEffect, useState } from "react";
import { readLastWalletId } from "@/services/auth";
import { readStoredSite, siteLabel } from "@/utils/navigation";
import { getWeb3AuthUserProfile } from "@/services/web3auth-connect";
import { useSession } from "@/context/SessionContext";
import { WalletId } from "@txnlab/use-wallet";

export type ProfileIdentity = {
  name: string;
  email: string | null;
  profileImage: string | null;
  initials: string;
};

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "OP";
}

export function useProfileIdentity(): ProfileIdentity {
  const { walletAddress } = useSession();
  const site = readStoredSite(walletAddress);
  const fallbackName = siteLabel(site ?? undefined) || "Oscorp Operator";
  const [identity, setIdentity] = useState<ProfileIdentity>({
    name: fallbackName,
    email: null,
    profileImage: null,
    initials: buildInitials(fallbackName),
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (readLastWalletId() !== WalletId.WEB3AUTH) {
        if (!cancelled) {
          setIdentity({
            name: fallbackName,
            email: null,
            profileImage: null,
            initials: buildInitials(fallbackName),
          });
        }
        return;
      }

      const profile = await getWeb3AuthUserProfile();
      if (cancelled) return;

      const name = profile?.name?.trim() || fallbackName;
      setIdentity({
        name,
        email: profile?.email?.trim() || null,
        profileImage: profile?.profileImage || null,
        initials: buildInitials(name),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackName, walletAddress]);

  return identity;
}
