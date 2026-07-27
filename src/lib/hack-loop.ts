import {NS} from "@ns";

/** Weakens/grows/hacks target forever, keeping security near its floor and money near its cap. */
export async function runHackLoop(ns: NS, target: string): Promise<void> {
    const securityThresh = ns.getServerMinSecurityLevel(target) + 5;
    const moneyThresh = ns.getServerMaxMoney(target) * 0.75;

    while (true) {
        if (ns.getServerSecurityLevel(target) > securityThresh) {
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            await ns.grow(target);
        } else {
            await ns.hack(target);
        }
    }
}
