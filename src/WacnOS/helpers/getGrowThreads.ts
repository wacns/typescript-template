import {NS} from "@ns";

/**
 * Grow threads needed to take a server from its current money to its maximum.
 *
 * Two paths, because the accurate one needs a program the player may not own:
 *
 *  1. With Formulas.exe, ns.formulas.hacking.growThreads gives the exact answer for the current
 *     server and player state.
 *  2. Without it, ns.growthAnalyze(host, multiplier) is used instead. It is free of Formulas.exe,
 *     takes a multiplicative growth factor rather than a target amount, and ignores the +$1/thread
 *     additive term the game applies first - so it over-estimates slightly at very low money.
 *     Over-estimating is the safe direction here: the caller caps threads to its RAM budget.
 *
 * Returning 0 when this cannot be computed was a real bug. hackloop.ts does Math.max(1, result),
 * so a 0 became exactly ONE grow thread - and with no Formulas.exe (the normal state right after
 * an augmentation install) the hacking loop dispatched a single thread per cycle against a
 * multi-terabyte RAM pool, earning nothing. It went unnoticed because SphyxOS's batcher was
 * running alongside and doing the real work.
 */
export async function main(ns: NS): Promise<void> {
    const hostname = ns.args[0] as string;
    let threads = 0;

    try {
        const server = ns.getServer(hostname);
        const maxMoney = server.moneyMax ?? 0;
        const current = server.moneyAvailable ?? 0;

        if (maxMoney > 0) {
            if (ns.fileExists("Formulas.exe", "home")) {
                const player = ns.getPlayer();
                threads = Math.ceil(ns.formulas.hacking.growThreads(server, player, maxMoney));
            } else {
                // growthAnalyze needs a multiplier > 1; clamp current money away from zero so a
                // freshly-reset server (money 0) doesn't produce Infinity.
                const multiplier = maxMoney / Math.max(current, 1);
                if (multiplier > 1) threads = Math.ceil(ns.growthAnalyze(hostname, multiplier));
            }
        }
    } catch {
        threads = 0;
    }

    // Guard against NaN/Infinity reaching the caller, which would poison its thread arithmetic.
    if (!Number.isFinite(threads) || threads < 0) threads = 0;

    ns.atExit(() => ns.writePort(ns.pid, threads));
}
