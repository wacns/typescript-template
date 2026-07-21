import { NS } from "@ns";
import { runHackLoop } from "lib/hack-loop";
import { hasFormulas, computeHackThresholds } from "lib/hack-formulas";

/**
 * Same weaken/grow/hack loop as worker.ts, but with thresholds computed from ns.formulas.hacking
 * instead of a flat guess. Falls back to the plain runHackLoop the moment Formulas.exe isn't available
 * or a formulas call fails, so losing the program (e.g. around an augmentation install) degrades this
 * to ordinary worker.ts behavior instead of crashing.
 */
export async function main(ns: NS): Promise<void> {
    const target = ns.args[0] as string;
    if (!target) return;

    if (!hasFormulas(ns)) {
        await runHackLoop(ns, target);
        return;
    }

    while (true) {
        const thresholds = computeHackThresholds(ns, target);
        if (thresholds === null) {
            await runHackLoop(ns, target);
            return;
        }

        if (ns.getServerSecurityLevel(target) > thresholds.securityThresh) {
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < thresholds.moneyThresh) {
            await ns.grow(target);
        } else {
            await ns.hack(target);
        }
    }
}
