import { WALLET_BRANDS } from "@/lib/wallet-logos";
import type { WalletId } from "@txnlab/use-wallet";

const brandById = Object.fromEntries(WALLET_BRANDS.map((b) => [b.id, b])) as Record<
  WalletId,
  (typeof WALLET_BRANDS)[number]
>;

export function WalletBrandIcon({
  walletId,
  size = 40,
  className = "",
}: {
  walletId: WalletId;
  size?: number;
  className?: string;
}) {
  const brand = brandById[walletId];
  if (!brand) return null;

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-[12px] ring-1 ring-black/[0.06] ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={brand.logoSrc}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </span>
  );
}
