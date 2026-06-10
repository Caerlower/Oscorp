import algosdk from "algosdk";
import { IS_ALGORAND_TESTNET, USDC_ASSET_ID, formatUsdc } from "@/constants/payment-constants";

export type TxnApprovalDetails = {
  title: string;
  message: string;
  details: { label: string; value: string }[];
};

function truncate(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function addressesMatch(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase();
}

export function describeAlgosdkTransaction(txn: algosdk.Transaction): TxnApprovalDetails {
  const sender = txn.sender.toString();
  const axfer = txn.assetTransfer;

  if (txn.type === "axfer" && axfer) {
    const assetId = Number(axfer.assetIndex);
    const amount = Number(axfer.amount);
    const receiver = axfer.receiver.toString();
    const isOptIn =
      amount === 0 && assetId === USDC_ASSET_ID && addressesMatch(receiver, sender);

    if (isOptIn) {
      return {
        title: "Enable USDC payments",
        message: "One-time setup to hold and send USDC on Algorand.",
        details: [
          { label: "Action", value: "Asset opt-in" },
          { label: "Asset", value: `USDC${IS_ALGORAND_TESTNET ? " (TestNet)" : ""}` },
          { label: "Asset ID", value: String(assetId) },
          { label: "Network fee", value: "~0.001 ALGO" },
          { label: "Wallet", value: truncate(sender) },
        ],
      };
    }

    const usdcAmount = amount / 1_000_000;
    return {
      title: "Send USDC",
      message: `Transfer ${formatUsdc(usdcAmount)} from your wallet.`,
      details: [
        { label: "Amount", value: formatUsdc(usdcAmount) },
        { label: "To", value: truncate(receiver) },
        { label: "Asset", value: `USDC${IS_ALGORAND_TESTNET ? " (TestNet)" : ""}` },
        { label: "Network fee", value: "~0.001 ALGO" },
        { label: "From", value: truncate(sender) },
      ],
    };
  }

  return {
    title: "Confirm transaction",
    message: "Review this Algorand transaction before approving.",
    details: [
      { label: "Type", value: String(txn.type) },
      { label: "Wallet", value: truncate(sender) },
      { label: "Network fee", value: "~0.001 ALGO" },
    ],
  };
}
