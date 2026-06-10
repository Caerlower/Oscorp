import { X } from "lucide-react";
import { WalletAddressQr } from "@/components/wallet/wallet-address-qr";

export function WalletQrModal({
  open,
  address,
  title,
  onClose,
}: {
  open: boolean;
  address: string | null;
  title: string;
  onClose: () => void;
}) {
  if (!open || !address) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pb-2 pt-5">
          <h2 className="pr-8 text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan with Pera, Defly, or another Algorand wallet to send ALGO or USDC.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <WalletAddressQr address={address} label="Wallet address" />
          <button
            type="button"
            onClick={onClose}
            className="auth-btn-primary mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
