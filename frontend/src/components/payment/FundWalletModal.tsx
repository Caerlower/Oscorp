import { X } from "lucide-react";
import { WalletAddressQr } from "@/components/wallet/wallet-address-qr";
import { IS_ALGORAND_TESTNET } from "@/constants/payment-constants";
import type { PaymentReadinessIssue } from "@/utils/algorand-wallet";

export type FundPrompt = {
  issue: PaymentReadinessIssue;
  message: string;
  walletAddress: string;
};

const TITLES: Record<PaymentReadinessIssue, string> = {
  insufficient_usdc: "Fund USDC to continue",
  insufficient_algo: "Fund ALGO for fees",
  no_usdc_optin: "Enable USDC first",
};

export function FundWalletModal({
  prompt,
  onClose,
}: {
  prompt: FundPrompt | null;
  onClose: () => void;
}) {
  if (!prompt) return null;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pb-3 pt-5">
          <h2 className="pr-8 text-base font-semibold">{TITLES[prompt.issue]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{prompt.message}</p>
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
          {prompt.issue === "no_usdc_optin" ? (
            <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Complete wallet setup in onboarding to opt in to USDC, then try again.
            </p>
          ) : (
            <>
              <WalletAddressQr address={prompt.walletAddress} />
              {IS_ALGORAND_TESTNET && prompt.issue === "insufficient_algo" && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Need testnet ALGO?{" "}
                  <a
                    href="https://bank.testnet.algorand.network/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Get free ALGO from the dispenser
                  </a>
                </p>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="auth-btn-primary mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
