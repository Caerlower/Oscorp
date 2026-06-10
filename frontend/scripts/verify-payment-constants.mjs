import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(
  readFileSync(join(root, "shared/payment-constants.json"), "utf8"),
);

const constantsSource = readFileSync(
  join(root, "frontend/src/constants/payment-constants.ts"),
  "utf8",
);

if (!constantsSource.includes("shared/payment-constants.json")) {
  throw new Error(
    "payment-constants.ts must import shared/payment-constants.json",
  );
}

for (const agent of manifest.paidAgents) {
  const price = manifest.agentPrices[agent];
  if (typeof price !== "number") {
    throw new Error(`Missing price for paid agent: ${agent}`);
  }
}

if (!constantsSource.includes("paymentManifest.paidAgents")) {
  throw new Error("payment-constants.ts must derive paid agents from manifest");
}

console.log("Payment constants manifest OK");
