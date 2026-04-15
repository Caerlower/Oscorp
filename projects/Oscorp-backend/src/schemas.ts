import { z } from "zod";

export const createOscorpSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(100),
  metadataUri: z.string().min(1).max(2048),
  creatorAddress: z.string().min(10).max(128),
  investorAddress: z.string().min(10).max(128),
  treasuryAddress: z.string().min(10).max(128),
  pulseUnitName: z.string().min(2).max(8),
  pulseAssetName: z.string().min(1).max(32),
  pulseTotal: z.coerce.number().int().positive(),
  pulseDecimals: z.coerce.number().int().min(0).max(19).default(6),
  creatorShareBps: z.coerce.number().int().min(0).max(10000).default(6000),
  investorShareBps: z.coerce.number().int().min(0).max(10000).default(2500),
  treasuryShareBps: z.coerce.number().int().min(0).max(10000).default(1500),
  launchpadFeeBps: z.coerce.number().int().min(0).max(2000).default(300),
  approvalThresholdUsdc: z.coerce.number().int().nonnegative().default(10),
  gtmBudgetUsdc: z.coerce.number().int().nonnegative().default(200),
  minPatronPulse: z.coerce.number().int().nonnegative().default(0),
});

export const distributeRevenueSchema = z.object({
  appId: z.coerce.number().int().positive(),
  amountMicroUsdc: z.coerce.number().int().positive(),
});

export const updateOscorpPolicySchema = z.object({
  appId: z.coerce.number().int().positive(),
  approvalThresholdUsdc: z.coerce.number().int().nonnegative(),
  gtmBudgetUsdc: z.coerce.number().int().nonnegative(),
  minPatronPulse: z.coerce.number().int().nonnegative(),
});
