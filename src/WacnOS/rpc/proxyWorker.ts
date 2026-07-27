import {NS} from "@ns";

/**
 * Disposable process exec'd by rpc/proxy.ts. Resolves a dotted ns.* method path (e.g.
 * "singularity.getOwnedAugmentations") passed as args[0], calls it with the remaining args, and
 * writes the result back over its own pid-keyed port. Ported from SphyxOS's extras/nsProxy.js.
 */
export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    const funcPath = ns.args[0] as string;
    const callArgs = ns.args.slice(1);

    let target: unknown = ns;
    for (const prop of funcPath.split(".")) {
        target = (target as Record<string, unknown>)[prop];
    }

    let result: unknown;
    try {
        const raw = (target as (...a: unknown[]) => unknown)(...callArgs);
        result = raw instanceof Promise ? await raw : stripPromises(raw);
    } catch {
        result = undefined;
    }

    ns.atExit(() => ns.writePort(ns.pid, result));
}

/** Netscript ports can't serialize Promise-valued properties - drop them so the rest of the object survives. */
function stripPromises(value: unknown): unknown {
    if (!value || typeof value !== "object") return value;
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
        const nested = record[key];
        if (nested instanceof Promise) delete record[key];
        else if (nested && typeof nested === "object") stripPromises(nested);
    }
    return value;
}
