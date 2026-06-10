import { useEffect, useState, type ReactNode } from "react";
import { FundWalletModal } from "@/components/payment/FundWalletModal";
import { AgentWalletTopUpModal } from "@/components/payment/AgentWalletTopUpModal";
import { X402PaymentConfirmModal } from "@/components/payment/X402PaymentConfirmModal";
import { TransactionApprovalModal } from "@/components/wallet/transaction-approval-modal";
import { PaidAgentsProvider, usePaidAgents } from "@/context/PaidAgentsContext";
import { PaymentContext } from "@/context/payment-context-state";
import { TransactionSignerContext } from "@/context/transaction-signer-context";
import { usePayment } from "@/hooks/usePayment";
import {
  registerX402ApprovalBridge,
  unregisterX402ApprovalBridge,
} from "@/hooks/useX402Fetch";
import { useTransactionSigner } from "@/hooks/useTransactionSigner";

export { usePaymentContext } from "@/context/payment-context-state";
export { useTransactionSignerContext } from "@/context/transaction-signer-context";

function PaymentProviderInner({ children }: { children: ReactNode }) {
  const signer = useTransactionSigner();
  const { markAgentPaid, unmarkAgentPaid, refreshPaidAgents } = usePaidAgents();
  const payment = usePayment(signer, { markAgentPaid, unmarkAgentPaid, refreshPaidAgents });
  const [x402Confirm, setX402Confirm] = useState<{
    amount: string;
    description: string;
    resolve: (approved: boolean) => void;
  } | null>(null);

  useEffect(() => {
    registerX402ApprovalBridge((request) => setX402Confirm(request));
    return () => unregisterX402ApprovalBridge();
  }, []);

  return (
    <TransactionSignerContext.Provider value={signer}>
      <PaymentContext.Provider value={payment}>
        {children}
        <TransactionApprovalModal
          open={signer.approvalOpen}
          busy={signer.approvalBusy}
          approval={signer.approvalDetails}
          onCancel={signer.cancelApproval}
          onApprove={() => void signer.approvePending()}
        />
        <FundWalletModal prompt={payment.fundPrompt} onClose={payment.closeFundPrompt} />
        <AgentWalletTopUpModal
          open={!!payment.agentWalletLow?.open}
          shortfall={payment.agentWalletLow?.shortfall ?? 1}
          busy={payment.busy}
          onTopUp={(amount) => void payment.topUpAgentWallet(amount)}
          onCancel={payment.closeAgentWalletLow}
        />
        <X402PaymentConfirmModal
          open={!!x402Confirm}
          amount={x402Confirm?.amount ?? ""}
          description={x402Confirm?.description ?? ""}
          onConfirm={() => {
            const resolve = x402Confirm?.resolve;
            setX402Confirm(null);
            resolve?.(true);
          }}
          onCancel={() => {
            const resolve = x402Confirm?.resolve;
            setX402Confirm(null);
            resolve?.(false);
          }}
        />
      </PaymentContext.Provider>
    </TransactionSignerContext.Provider>
  );
}

export function PaymentProvider({ children }: { children: ReactNode }) {
  return (
    <PaidAgentsProvider>
      <PaymentProviderInner>{children}</PaymentProviderInner>
    </PaidAgentsProvider>
  );
}
