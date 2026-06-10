import algosdk from "algosdk";
import { ALGOD_URL, ALGORAND_EXPLORER_URL, IS_ALGORAND_TESTNET } from "@/constants/payment-constants";
import { getWeb3AuthClientId } from "@/constants/wallet-config";
import { preloadWeb3AuthDeps } from "@/utils/preload-wallet-deps";
import type { Web3AuthNoModal } from "@web3auth/no-modal";
import type { IProvider } from "@web3auth/base";

let client: Web3AuthNoModal | null = null;
let initPromise: Promise<Web3AuthNoModal> | null = null;

const AGENT_WALLET_DOMAIN = "oscorp-agent-wallet-v1";

export type AgentWallet = {
  address: string;
  secretKey: Uint8Array;
};

let cachedAgentWallet: AgentWallet | null = null;

export function resetWeb3AuthClient(): void {
  client = null;
  initPromise = null;
  cachedAgentWallet = null;
}

export function clearAgentWalletCache(): void {
  cachedAgentWallet = null;
}

async function getClient(): Promise<Web3AuthNoModal> {
  if (client) return client;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await preloadWeb3AuthDeps();

    const [
      { Web3AuthNoModal },
      { AuthAdapter },
      { CHAIN_NAMESPACES, WEB3AUTH_NETWORK },
      { CommonPrivateKeyProvider },
    ] = await Promise.all([
      import("@web3auth/no-modal"),
      import("@web3auth/auth-adapter"),
      import("@web3auth/base"),
      import("@web3auth/base-provider"),
    ]);

    const clientId = getWeb3AuthClientId();
    if (clientId.length < 10) {
      throw new Error("VITE_WEB3AUTH_CLIENT_ID is not configured.");
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "https://oscorp.app";
    const redirectUrl = `${origin}/auth`;

    const privateKeyProvider = new CommonPrivateKeyProvider({
      config: {
        chainConfig: {
          chainNamespace: CHAIN_NAMESPACES.OTHER,
          chainId: IS_ALGORAND_TESTNET ? "algorand-testnet" : "algorand",
          rpcTarget: ALGOD_URL,
          displayName: IS_ALGORAND_TESTNET ? "Algorand TestNet" : "Algorand",
          blockExplorerUrl: ALGORAND_EXPLORER_URL,
          ticker: "ALGO",
          tickerName: "Algorand",
        },
      },
    });

    const web3auth = new Web3AuthNoModal({
      clientId,
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      privateKeyProvider,
    });

    const authAdapter = new AuthAdapter({
      privateKeyProvider,
      adapterSettings: {
        clientId,
        uxMode: "popup",
        redirectUrl,
        replaceUrlOnRedirect: true,
        whiteLabel: {
          appName: "Oscorp",
          logoLight: `${origin}/oscorp-mark.svg`,
          logoDark: `${origin}/oscorp-mark.svg`,
          defaultLanguage: "en",
          mode: "light",
        },
      },
    });

    web3auth.configureAdapter(authAdapter);
    await web3auth.init();
    client = web3auth;
    return web3auth;
  })();

  return initPromise;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

async function addressFromProvider(provider: IProvider): Promise<string> {
  const privateKeyHex = await privateKeyHexFromProvider(provider);
  const { address } = await keyPairFromPrivateKeyHex(privateKeyHex);
  return address;
}

function activeProvider(w3a: Web3AuthNoModal): IProvider | null {
  if (w3a.connected && w3a.provider) {
    return w3a.provider;
  }
  return null;
}

function isAlreadyConnectedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("already connected");
}

/** True when returning from an OAuth redirect back to /auth. */
export function hasWeb3AuthRedirectParams(): boolean {
  if (typeof window === "undefined") return false;
  const { search, hash } = window.location;
  const blob = `${search}${hash}`;
  return blob.includes("state=") || blob.includes("code=") || blob.includes("sessionId=");
}

export type Web3AuthConnectMethod = "google" | "email";

export type Web3AuthConnectOptions = {
  /** Log out first and show the provider picker — required for account switches. */
  forceFresh?: boolean;
};

export async function getWeb3AuthAddressIfConnected(): Promise<string | null> {
  try {
    const w3a = await getClient();
    const provider = activeProvider(w3a);
    if (!provider) return null;
    return await addressFromProvider(provider);
  } catch {
    return null;
  }
}

export async function connectWeb3AuthDirect(
  method: Web3AuthConnectMethod,
  emailHint?: string,
  options?: Web3AuthConnectOptions,
): Promise<string> {
  if (options?.forceFresh) {
    await logoutWeb3AuthDirect();
  }

  const w3a = await getClient();
  const { WALLET_ADAPTERS } = await import("@web3auth/base");
  const origin = typeof window !== "undefined" ? window.location.origin : "https://oscorp.app";

  if (method === "email" && !emailHint?.trim()) {
    throw new Error("Enter your email address.");
  }

  if (!options?.forceFresh) {
    const existing = activeProvider(w3a);
    if (existing) {
      return addressFromProvider(existing);
    }
  }

  let provider: IProvider | null = null;
  try {
    provider = await w3a.connectTo(WALLET_ADAPTERS.AUTH, {
      loginProvider: method === "google" ? "google" : "email_passwordless",
      extraLoginOptions:
        method === "email"
          ? { login_hint: emailHint!.trim(), domain: origin }
          : undefined,
    });
  } catch (err) {
    if (!options?.forceFresh && isAlreadyConnectedError(err)) {
      const retry = activeProvider(w3a);
      if (retry) {
        return addressFromProvider(retry);
      }
    }
    throw err;
  }

  if (!provider) {
    throw new Error("Sign-in was cancelled.");
  }

  return addressFromProvider(provider);
}

async function privateKeyHexFromProvider(provider: IProvider): Promise<string> {
  const privateKeyHex = await provider.request({ method: "private_key" });
  if (!privateKeyHex || typeof privateKeyHex !== "string") {
    throw new Error("Could not read wallet key from Web3Auth.");
  }
  return privateKeyHex;
}

async function keyPairFromPrivateKeyHex(privateKeyHex: string): Promise<{
  address: string;
  secretKey: Uint8Array;
}> {
  const raw = hexToBytes(privateKeyHex);
  const seed = raw.length >= 32 ? raw.slice(0, 32) : raw;
  if (seed.length !== 32) {
    throw new Error("Invalid key length from Web3Auth.");
  }

  const naclModule = await import("tweetnacl");
  const nacl = (naclModule as unknown as { default?: typeof naclModule }).default ?? naclModule;
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  return {
    address: algosdk.encodeAddress(keyPair.publicKey),
    secretKey: keyPair.secretKey,
  };
}

async function secretKeyFromProvider(provider: IProvider): Promise<Uint8Array> {
  const privateKeyHex = await privateKeyHexFromProvider(provider);
  const { secretKey } = await keyPairFromPrivateKeyHex(privateKeyHex);
  return secretKey;
}

/** Deterministic agent wallet derived from the Web3Auth private key (memory only). */
export async function deriveAgentWallet(mainPrivateKeyHex: string): Promise<AgentWallet> {
  const encoder = new TextEncoder();
  const keyBytes = new Uint8Array(hexToBytes(mainPrivateKeyHex));
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await window.crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(AGENT_WALLET_DOMAIN),
  );

  const agentSeed = new Uint8Array(signature).slice(0, 32);
  const naclModule = await import("tweetnacl");
  const nacl = (naclModule as unknown as { default?: typeof naclModule }).default ?? naclModule;
  const keyPair = nacl.sign.keyPair.fromSeed(agentSeed);

  return {
    address: algosdk.encodeAddress(keyPair.publicKey),
    secretKey: keyPair.secretKey,
  };
}

export async function deriveAgentWalletFromSession(): Promise<AgentWallet> {
  if (cachedAgentWallet) return cachedAgentWallet;

  const w3a = await getClient();
  const provider = activeProvider(w3a);
  if (!provider) {
    throw new Error("Social wallet session expired. Sign in again.");
  }

  const privateKeyHex = await privateKeyHexFromProvider(provider);
  cachedAgentWallet = await deriveAgentWallet(privateKeyHex);
  return cachedAgentWallet;
}

export async function getWeb3AuthSecretKey(): Promise<Uint8Array> {
  const w3a = await getClient();
  const provider = activeProvider(w3a);
  if (!provider) {
    throw new Error("Social wallet session expired. Sign in again.");
  }
  return secretKeyFromProvider(provider);
}

export async function signTransactionWithWeb3Auth(txn: algosdk.Transaction): Promise<Uint8Array> {
  const sk = await getWeb3AuthSecretKey();
  return txn.signTxn(sk);
}

export type Web3AuthUserProfile = {
  name?: string;
  email?: string;
  profileImage?: string;
};

export async function getWeb3AuthUserProfile(): Promise<Web3AuthUserProfile | null> {
  try {
    const w3a = await getClient();
    if (!w3a.connected) return null;
    const info = await w3a.getUserInfo();
    return {
      name: info.name,
      email: info.email,
      profileImage: info.profileImage,
    };
  } catch {
    return null;
  }
}

export async function logoutWeb3AuthDirect(): Promise<void> {
  try {
    const w3a = client ?? (await getClient().catch(() => null));
    if (w3a?.connected) {
      await w3a.logout({ cleanup: true });
    }
  } catch {
    /* ignore */
  } finally {
    clearAgentWalletCache();
    resetWeb3AuthClient();
  }
}
