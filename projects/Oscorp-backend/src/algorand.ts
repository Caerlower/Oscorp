import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import algosdk from "algosdk";
import { env } from "./config.js";

export function getAlgorandClient() {
  return AlgorandClient.fromConfig({
    algodConfig: {
      server: env.ALGOD_SERVER,
      port: env.ALGOD_PORT,
      token: env.ALGOD_TOKEN,
    },
    indexerConfig: {
      server: env.INDEXER_SERVER,
      port: env.INDEXER_PORT,
      token: env.INDEXER_TOKEN,
    },
  });
}

export function getAlgodClient() {
  return new algosdk.Algodv2(env.ALGOD_TOKEN, env.ALGOD_SERVER, env.ALGOD_PORT);
}

export function getIndexerClient() {
  return new algosdk.Indexer(env.INDEXER_TOKEN, env.INDEXER_SERVER, env.INDEXER_PORT);
}
