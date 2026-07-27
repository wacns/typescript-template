import {NS} from "@ns";

const PROXY_WORKER_SCRIPT = "WacnOS/rpc/proxyWorker.js";
/** proxyWorker.ts's own overhead: ns.disableLog/ns.atExit/ns.writePort plus property-lookup logic. */
const PROXY_BASE_RAM = 1.6;

/**
 * Calls any ns.* method by its dotted path (e.g. "singularity.getOwnedAugmentations") through a
 * disposable proxy process, so the calling script never pays that function's RAM cost statically.
 * RAM for the temporary process is sized at call time via ns.getFunctionRamCost, so only scripts
 * that actually call proxy() for a given function pay for it - never every script that merely
 * imports this file. WacnOS's version of SphyxOS's ramDodgeProxy/nsProxy.js pairing.
 */
export async function proxy(ns: NS, funcPath: string, ...args: (string | number | boolean)[]): Promise<unknown> {
    const ramOverride = ns.getFunctionRamCost(funcPath) + PROXY_BASE_RAM;
    const pid = ns.exec(PROXY_WORKER_SCRIPT, "home", {threads: 1, temporary: true, ramOverride}, funcPath, ...args);
    if (pid === 0) throw new Error(`WacnOS proxy: failed to run ${funcPath}`);
    await ns.nextPortWrite(pid);
    return ns.readPort(pid);
}
