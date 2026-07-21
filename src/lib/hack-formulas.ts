import { NS } from "@ns";

/**
 * Formulas.exe is a purchasable program, not a permanent unlock - if it's ever missing (never bought,
 * or lost some other way, e.g. around an augmentation install), formulas.hacking.* throws. Kept in its
 * own file so that losing it only affects scripts that explicitly opt into formula-based hacking
 * (formula-worker.ts), never the plain worker.ts every server runs by default.
 */
export function hasFormulas(ns: NS): boolean {
    return ns.fileExists("Formulas.exe", "home");
}

export interface HackThresholds {
    securityThresh: number;
    moneyThresh: number;
}

/**
 * Computes weaken/grow thresholds that adapt to the actual thread count and hack skill deployed against
 * this target, instead of hack-loop.ts's flat "min security + 5" / "75% of max money" guess. Returns
 * null if Formulas.exe isn't available or a formulas call throws, so the caller can fall back safely.
 */
export function computeHackThresholds(ns: NS, target: string): HackThresholds | null {
    if (!hasFormulas(ns)) return null;

    try {
        const server = ns.getServer(target);
        const player = ns.getPlayer();
        const threads = ns.getRunningScript()?.threads ?? 1;

        const securityThresh = ns.getServerMinSecurityLevel(target) + 5;

        const hackPercentPerThread = ns.formulas.hacking.hackPercent(server, player);
        const expectedHackRemoval = Math.min(0.9, hackPercentPerThread * threads);
        // Keep enough buffer above what one hack pass at this thread count is expected to remove.
        const moneyThresh = ns.getServerMaxMoney(target) * Math.max(0.5, 1 - expectedHackRemoval * 1.5);

        return { securityThresh, moneyThresh };
    } catch {
        return null;
    }
}
