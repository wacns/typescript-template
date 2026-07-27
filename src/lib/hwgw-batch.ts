import {NS, Server} from "@ns";
import {hasFormulas} from "lib/hack-formulas";

export interface BatchStep {
    action: "hack" | "grow" | "weaken";
    threads: number;
    delayMs: number;
}

export interface BatchPlan {
    steps: BatchStep[];
    cycleTimeMs: number;
}

const SPACING_MS = 200;
const HACK_FRACTION = 0.25; // steal ~25% of max money per batch - conservative, keeps thread counts modest

/**
 * Computes a full Hack-Weaken-Grow-Weaken batch: exact thread counts (via ns.formulas.hacking) and
 * delays so all four actions *finish* in H, W1, G, W2 order with SPACING_MS between each finish,
 * regardless of their different run times. Effects (money/security) apply at completion time, not
 * start time, so ordering completions is what actually matters here.
 *
 * Assumes the target is already "prepped" (security at min, money at max) - the caller is responsible
 * for getting it there first (e.g. via formula-worker.ts / worker.ts) before switching to batching.
 *
 * Thread counts assume 1 CPU core (a safe, if slightly conservative, default for rented/hacked servers).
 * Returns null if Formulas.exe isn't available or a formulas call throws.
 */
export function planBatch(ns: NS, target: string): BatchPlan | null {
    if (!hasFormulas(ns)) return null;

    try {
        const server = ns.getServer(target);
        const player = ns.getPlayer();
        const maxMoney = server.moneyMax ?? 0;
        if (maxMoney <= 0) return null;

        const hackTime = ns.formulas.hacking.hackTime(server, player);
        const growTime = ns.formulas.hacking.growTime(server, player);
        const weakenTime = ns.formulas.hacking.weakenTime(server, player);

        const hackPercentPerThread = ns.formulas.hacking.hackPercent(server, player);
        if (hackPercentPerThread <= 0) return null;
        const hackThreads = Math.max(1, Math.floor(HACK_FRACTION / hackPercentPerThread));

        const hackSecurityIncrease = ns.hackAnalyzeSecurity(hackThreads, target);
        const weakenPerThread = ns.weakenAnalyze(1);
        const weaken1Threads = Math.max(1, Math.ceil(hackSecurityIncrease / weakenPerThread));

        const moneyAfterHack = Math.max(1, maxMoney * (1 - HACK_FRACTION));
        const postHackServer: Server = {...server, moneyAvailable: moneyAfterHack};
        const growThreads = Math.max(1, Math.ceil(ns.formulas.hacking.growThreads(postHackServer, player, maxMoney)));

        const growSecurityIncrease = ns.growthAnalyzeSecurity(growThreads, target);
        const weaken2Threads = Math.max(1, Math.ceil(growSecurityIncrease / weakenPerThread));

        // Align every action's finish time to the slowest one (weaken), spaced SPACING_MS apart, so
        // each action's delay (targetFinish - ownDuration) works out non-negative.
        const T0 = Math.max(
            hackTime,
            weakenTime - SPACING_MS,
            growTime - 2 * SPACING_MS,
            weakenTime - 3 * SPACING_MS
        );

        const steps: BatchStep[] = [
            {action: "hack", threads: hackThreads, delayMs: T0 - hackTime},
            {action: "weaken", threads: weaken1Threads, delayMs: T0 + SPACING_MS - weakenTime},
            {action: "grow", threads: growThreads, delayMs: T0 + 2 * SPACING_MS - growTime},
            {action: "weaken", threads: weaken2Threads, delayMs: T0 + 3 * SPACING_MS - weakenTime}
        ];

        return {steps, cycleTimeMs: T0 + 4 * SPACING_MS};
    } catch {
        return null;
    }
}
