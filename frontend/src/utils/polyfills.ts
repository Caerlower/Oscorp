/**
 * Must load before any wallet / Web3Auth code.
 * @see https://docs.metamask.io/embedded-wallets/troubleshooting/vite-issues/
 */
import { Buffer } from "buffer";
import process from "process";

const env = {
  NODE_ENV: import.meta.env.MODE ?? "development",
  ...process.env,
};

const proc = Object.assign(process, { env });

if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & {
    global?: typeof globalThis;
    Buffer?: typeof Buffer;
    process?: typeof proc;
  };
  g.global = g.global ?? globalThis;
  g.Buffer = Buffer;
  g.process = proc;
}

if (typeof window !== "undefined") {
  const w = window as Window & { Buffer?: typeof Buffer; process?: typeof proc };
  w.Buffer = Buffer;
  w.process = proc;
}
