import {NS} from "@ns";

/** One-shot hack/grow/weaken action, exec'd across rooted servers by launcher/hackloop.ts. Args: [target, action, delayMs]. */
export async function main(ns: NS): Promise<void> {
    const target = ns.args[0] as string;
    const action = ns.args[1] as string;
    const delayMs = (ns.args[2] as number) || 0;

    if (action === "grow") await ns.grow(target, {additionalMsec: delayMs});
    else if (action === "weaken") await ns.weaken(target, {additionalMsec: delayMs});
    else await ns.hack(target, {additionalMsec: delayMs});
}
