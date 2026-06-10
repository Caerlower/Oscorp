import type { ClientAvmSigner } from "@x402-avm/avm";
import type { RawEd25519Signer } from "@algorandfoundation/algokit-utils/crypto";

type AlgokitModules = {
  crypto: typeof import("@algorandfoundation/algokit-utils/crypto");
  transact: typeof import("@algorandfoundation/algokit-utils/transact");
};

let algokitModules: AlgokitModules | null = null;

async function loadAlgokitModules(): Promise<AlgokitModules> {
  if (!algokitModules) {
    const [crypto, transact] = await Promise.all([
      import("@algorandfoundation/algokit-utils/crypto"),
      import("@algorandfoundation/algokit-utils/transact"),
    ]);
    algokitModules = { crypto, transact };
  }
  return algokitModules;
}

/** Sign x402-encoded txn bytes the same way @x402-avm/avm `toClientAvmSigner` does. */
export async function signAlgokitTxnBytes(
  txnBytes: Uint8Array,
  rawEd25519Signer: RawEd25519Signer,
): Promise<Uint8Array> {
  const { transact } = await loadAlgokitModules();
  const decoded = transact.decodeTransaction(txnBytes);
  const msg = transact.bytesForSigning.transaction(decoded);
  const sig = await rawEd25519Signer(msg);
  return transact.encodeSignedTransaction({ txn: decoded, sig });
}

export async function rawEd25519SignerFromSecretKey(secretKey: Uint8Array): Promise<RawEd25519Signer> {
  const { crypto } = await loadAlgokitModules();
  const seed = secretKey.length >= 64 ? secretKey.slice(0, 32) : secretKey;
  return crypto.ed25519Generator(seed).rawEd25519Signer;
}

export function buildClientAvmSigner(
  address: string,
  signTxnBytes: (txnBytes: Uint8Array) => Promise<Uint8Array>,
): ClientAvmSigner {
  return {
    address,
    signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
      const indices = indexesToSign ?? txns.map((_, index) => index);
      const result: (Uint8Array | null)[] = txns.map(() => null);
      await Promise.all(
        indices.map(async (index) => {
          result[index] = await signTxnBytes(txns[index]!);
        }),
      );
      return result;
    },
  };
}
