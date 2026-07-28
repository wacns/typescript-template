import {NS} from "@ns";

/**
 * ns.share() forever. Deployed in bulk across the network during the Daedalus grind.
 *
 * Sharing multiplies faction reputation gain by 1 + ln(effectiveThreads)/25
 * (PersonObjects/formulas/reputation.ts), which is the only reputation boost available without
 * Source-File 4 - and the 2.5m reputation The Red Pill needs is the longest single stretch of the
 * whole run, so a ~1.3x here is worth hours.
 *
 * Deliberately minimal: this file's RAM cost is multiplied by every thread we run, so it must
 * import nothing.
 */
export async function main(ns: NS): Promise<void> {
    for (; ;) {
        await ns.share();
    }
}
