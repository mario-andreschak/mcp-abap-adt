import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { Agent } from "node:https";
import { rootCertificates, createSecureContext } from "node:tls";
import type { SapConfig } from "../config";

const context = new AsyncLocalStorage<AbortSignal>();
export const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
export function withRequestSignal<T>(signal: AbortSignal, fn: () => T): T {
  return context.run(
    AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    fn,
  );
}
export function requestSignal(): AbortSignal | undefined {
  return context.getStore();
}

export function createSapAgent(config: SapConfig): Agent {
  let ca: string[] | undefined;
  if (config.caFile) {
    let pem: string;
    try {
      pem = readFileSync(config.caFile, "utf8");
      if (!pem.includes("-----BEGIN CERTIFICATE-----"))
        throw new Error("Invalid PEM");
      createSecureContext({ ca: pem });
    } catch {
      throw new Error(
        "SAP_CA_FILE must name a readable PEM certificate bundle",
      );
    }
    ca = [...rootCertificates, pem];
  }
  const rejectUnauthorized = config.rejectUnauthorized !== false;
  if (!rejectUnauthorized)
    console.error(
      "WARNING: TLS_REJECT_UNAUTHORIZED=0 disables SAP certificate verification. Use SAP_CA_FILE for private CAs.",
    );
  return new Agent({ rejectUnauthorized, ca });
}

export function assertSapTarget(url: string, config: SapConfig): void {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error("Invalid SAP request target");
  }
  if (
    target.origin !== new URL(config.url).origin ||
    target.username ||
    target.password ||
    target.hash ||
    !target.pathname.startsWith("/sap/bc/adt/")
  ) {
    throw new Error(
      "SAP request target must stay within the configured ADT origin",
    );
  }
}
