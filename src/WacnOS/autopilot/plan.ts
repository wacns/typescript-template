import {AugState, GameSnapshot, NEUROFLUX} from "WacnOS/bridge/gamestate";

/**
 * Deciding what to buy, and in what order.
 *
 * The ordering is not cosmetic. Every non-SoA augmentation you queue multiplies the price of every
 * LATER purchase in the same install cycle by ~1.9 (getGenericAugmentationPriceMultiplier), and the
 * prices in a snapshot already bake in the multiplier for the current queue. So a run of k
 * purchases costs `sum(cost_i * m^i)`, and by the rearrangement inequality that sum is minimised by
 * pairing the largest cost with the smallest power - i.e. buying most-expensive-first.
 *
 * Buying cheapest-first, the intuitive order, is the single most expensive mistake available here.
 */

export interface AugBuy {
    faction: string;
    aug: string;
    /** Price at the moment it would actually be bought, including the escalation from earlier buys. */
    moneyCost: number;
    repCost: number;
}

export interface PlanOptions {
    /** Top up leftover money with repeatable NeuroFlux levels. */
    allowNFG: boolean;
    /** Never spend below this - keeps infrastructure (home RAM, programs) fundable. */
    reserve: number;
}

/**
 * Reputation to aim for with a faction: enough for the most demanding augmentation we still want
 * from it. Grinding past this earns nothing but favor, so it's the natural stopping condition.
 */
export function repGoalFor(snap: GameSnapshot, faction: string): number {
    const state = snap.factions[faction];
    if (!state) return 0;

    let goal = 0;
    for (const name of state.augs) {
        const aug = snap.augs[name];
        if (!aug || aug.owned || aug.queued || aug.isNFG) continue;
        if (aug.repCost > goal) goal = aug.repCost;
    }
    return goal;
}

/** Augmentations from a faction we could buy right now, ignoring money. */
export function affordableByRep(snap: GameSnapshot, faction: string): AugState[] {
    const state = snap.factions[faction];
    if (!state?.joined) return [];

    return state.augs
        .map((name) => snap.augs[name])
        .filter((aug): aug is AugState => !!aug && !aug.owned && !aug.queued && !aug.isNFG)
        .filter((aug) => state.rep >= aug.repCost);
}

/**
 * A concrete purchase list for this install cycle.
 *
 * Candidates must be from a joined faction, unowned, unqueued, and within that faction's current
 * reputation. Prerequisites count as satisfied if the prereq is owned, queued, or earlier in this
 * same plan - matching the game, whose hasAugmentationPrereqs() also accepts queued augs.
 */
export function planPurchases(snap: GameSnapshot, joinedFactions: string[], opts: PlanOptions): AugBuy[] {
    const budget = snap.money - opts.reserve;
    if (budget <= 0) return [];

    // Best faction per augmentation: several factions can offer the same aug, and we only need one
    // of them to have the reputation.
    const candidates = new Map<string, AugBuy>();
    for (const faction of joinedFactions) {
        for (const aug of affordableByRep(snap, faction)) {
            if (!candidates.has(aug.name)) {
                candidates.set(aug.name, {faction, aug: aug.name, moneyCost: aug.moneyCost, repCost: aug.repCost});
            }
        }
    }

    // Most expensive first - see the note at the top of this file.
    const sorted = [...candidates.values()].sort((a, b) => b.moneyCost - a.moneyCost);

    const planned: AugBuy[] = [];
    const willHave = new Set<string>([...snap.owned, ...snap.queued]);
    let spent = 0;
    let step = 0;

    for (const candidate of sorted) {
        const aug = snap.augs[candidate.aug];
        if (!aug) continue;
        if (!aug.prereqs.every((p) => willHave.has(p))) continue;

        // The k-th purchase in this run pays the snapshot price scaled by the escalation from the
        // k purchases before it.
        const realCost = candidate.moneyCost * Math.pow(snap.priceMultiplier, step);
        if (spent + realCost > budget) continue;

        planned.push({...candidate, moneyCost: realCost});
        willHave.add(candidate.aug);
        spent += realCost;
        step++;
    }

    if (opts.allowNFG) {
        planned.push(...planNeuroFlux(snap, joinedFactions, budget - spent, step));
    }

    return planned;
}

/**
 * NeuroFlux is the only repeatable augmentation, so leftover money goes here. Each level costs
 * 1.14x the last AND counts toward the queue multiplier, so both escalations compound.
 *
 * It's bought from whichever joined faction has the most reputation, since NFG's requirement rises
 * with every level and that faction will stay viable longest.
 */
function planNeuroFlux(snap: GameSnapshot, joinedFactions: string[], budget: number, startStep: number): AugBuy[] {
    const nfg = snap.augs[NEUROFLUX];
    if (!nfg || budget <= 0) return [];

    const best = joinedFactions
        .filter((f) => snap.factions[f]?.augs.includes(NEUROFLUX))
        .sort((a, b) => (snap.factions[b]?.rep ?? 0) - (snap.factions[a]?.rep ?? 0))[0];
    if (!best) return [];

    const rep = snap.factions[best]?.rep ?? 0;
    const out: AugBuy[] = [];
    let cost = nfg.moneyCost;
    let repCost = nfg.repCost;
    let spent = 0;
    let step = startStep;

    // 1.14 per level (NeuroFluxGovernorLevelMult) on top of the 1.9-per-queued-aug escalation.
    while (rep >= repCost && spent + cost * Math.pow(snap.priceMultiplier, step) <= budget && out.length < 30) {
        const realCost = cost * Math.pow(snap.priceMultiplier, step);
        out.push({faction: best, aug: NEUROFLUX, moneyCost: realCost, repCost});
        spent += realCost;
        cost *= 1.14;
        repCost *= 1.14;
        step++;
    }

    return out;
}

/** Whether it's time to spend a reset installing what's queued. */
export function shouldInstall(snap: GameSnapshot, augsAtOnce: number, augGoal: number): boolean {
    const queued = snap.queued.length;
    if (queued === 0) return false;
    if (queued >= augsAtOnce) return true;
    // Don't sit on a queue that would complete the Daedalus gate.
    return snap.distinctOwnedPlusQueued >= augGoal;
}
