import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4001),
  ALGOD_SERVER: z.string().min(1),
  ALGOD_PORT: z.coerce.number().int().nonnegative().default(4001),
  ALGOD_TOKEN: z.string().min(1),
  INDEXER_SERVER: z.string().min(1),
  INDEXER_PORT: z.coerce.number().int().nonnegative().default(8980),
  INDEXER_TOKEN: z.string().min(1),
  DEPLOYER_MNEMONIC: z.string().min(1),
  PROTOCOL_TREASURY: z.string().min(1),
  USDC_ASSET_ID: z.coerce.number().int().positive().default(10458941),
  OSCORP_PAYMENT_MNEMONIC: z.string().optional(),
  OSCORP_API_KEY: z.string().min(1).default("oscorp_dev_key"),
});

export const env = envSchema.parse(process.env);
