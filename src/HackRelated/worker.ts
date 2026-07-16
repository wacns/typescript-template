import { NS } from "@ns";

/** @param {NS} ns */
export async function main(ns: NS) {
    const target = ns.args[0] as string;
    if (!target) return;

    // Correct thresholds: Target the absolute minimum security + buffer
    const targetSecurity = ns.getServerMinSecurityLevel(target) + 5;
    // Correct thresholds: Target a fraction of the maximum money pool
    const targetMoney = ns.getServerMaxMoney(target) * 0.75;

    while (true) {
        if (ns.getServerSecurityLevel(target) > targetSecurity) {
            // If security is higher than our acceptable threshold, weaken it
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < targetMoney) {
            // If money is lower than our target capacity, grow it
            await ns.grow(target);
        } else {
            // Otherwise, it's safe and rich enough to hack
            await ns.hack(target);
        }
    }
}