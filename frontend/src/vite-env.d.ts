/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ALGORAND_NETWORK: string;
  readonly VITE_USDC_ASSET_ID: string;
  readonly VITE_ALGOD_URL: string;
  readonly VITE_ALGOD_TOKEN: string;
  readonly VITE_WEB3AUTH_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
