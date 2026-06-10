import { Copy } from "lucide-react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { IS_ALGORAND_TESTNET } from "@/constants/payment-constants";

type WalletAddressQrProps = {
  address: string;
  label?: string;
};

export function WalletAddressQr({ address, label = "Your wallet address" }: WalletAddressQrProps) {
  const copy = () => {
    void navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  return (
    <div className="mt-5 space-y-4">
      <div className="mx-auto flex w-fit flex-col items-center gap-3">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <QRCode value={address} size={168} level="M" />
        </div>
        {IS_ALGORAND_TESTNET && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Algorand TestNet
          </span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted/30 p-3">
          <p className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-foreground">
            {address}
          </p>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}
