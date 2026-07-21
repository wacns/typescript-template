import { NS } from "@ns";

/** One-shot hack/grow/weaken with a built-in completion delay, launched by hwgw-batcher.ts. */
export async function main(ns: NS): Promise<void> {
    const target = ns.args[0] as string;
    const action = ns.args[1] as string;
    const delayMs = Math.max(0, Number(ns.args[2] ?? 0));

    if (action === "hack") {
        await ns.hack(target, { additionalMsec: delayMs });
    } else if (action === "grow") {
        await ns.grow(target, { additionalMsec: delayMs });
    } else if (action === "weaken") {
        await ns.weaken(target, { additionalMsec: delayMs });
    }
}
