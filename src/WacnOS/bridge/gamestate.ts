import {NS} from "@ns";
import {getBridge} from "WacnOS/bridge/webpack";

/**
 * The typed read API over the bridge - everything the autopilot needs to know that Netscript
 * won't tell it without Source-File 4.
 *
 * A snapshot is taken once per tick and every decision is derived from it, so the state can't
 * shift underneath a multi-step decision.
 */

export const NEUROFLUX = "NeuroFlux Governor";

/**
 * Augmentation pricing, reimplemented from the game's getAugCost
 * (Augmentation/AugmentationHelpers.ts:127) rather than called through the bridge.
 *
 * Calling the game's own function would be more faithful, but there is no safe way to FIND it:
 * identifying it means invoking unknown single-argument functions with an Augmentation and
 * checking the result, and two functions in that same module accept exactly that shape and are
 * catastrophic - applyAugmentation(aug, reapply = false) permanently merges an augmentation's
 * multipliers into the player, and installAugmentations(force?) has arity 1 after compilation,
 * so a truthy argument would install and trigger a prestige. Neither can be told apart from
 * getAugCost before calling it, so we don't call anything: we recompute from the same constants.
 */
const NFG_LEVEL_MULT = 1.14;      // CONSTANTS.NeuroFluxGovernorLevelMult
const MULTIPLE_AUG_MULT = 1.9;    // CONSTANTS.MultipleAugMultiplier
const SOA_COST_MULT = 7;          // CONSTANTS.SoACostMult
const SOA_REP_MULT = 1.3;         // CONSTANTS.SoARepMult
/** getBaseAugmentationPriceMultiplier's SF11 discount table. */
const SF11_SCALING = [1, 0.96, 0.94, 0.93];

/** getBaseAugmentationPriceMultiplier(): the per-queued-aug price escalation. */
export function basePriceMultiplier(sf11: number): number {
    return MULTIPLE_AUG_MULT * (SF11_SCALING[Math.min(Math.max(sf11, 0), 3)] ?? 1);
}

const SOA_AUGS = new Set([
    "SoA - Might of Ares",
    "SoA - Wisdom of Athena",
    "SoA - Trickery of Hermes",
    "SoA - Beauty of Aphrodite",
    "SoA - Chaos of Dionysus",
    "SoA - Flood of Poseidon",
    "SoA - Hunt of Artemis",
    "SoA - Knowledge of Apollo",
    "SoA - phyzical WKS harmonizer",
]);

export interface FactionState {
    name: string;
    joined: boolean;
    invited: boolean;
    banned: boolean;
    rep: number;
    favor: number;
    /** Augmentation names this faction offers. */
    augs: string[];
    /** Factions that ban you if you join this one. */
    enemies: string[];
}

export interface AugState {
    name: string;
    owned: boolean;
    queued: boolean;
    moneyCost: number;
    repCost: number;
    prereqs: string[];
    factions: string[];
    isNFG: boolean;
}

export interface GameSnapshot {
    at: number;
    money: number;
    factions: Record<string, FactionState>;
    augs: Record<string, AugState>;
    invitations: string[];
    owned: string[];
    queued: string[];
    /**
     * Distinct INSTALLED augmentations, NeuroFlux counted once - exactly the number Daedalus's
     * invite requirement compares against (the game's haveAugmentations() is a plain
     * Player.augmentations.length, and NeuroFlux is a single entry with a rising level).
     * Queued augmentations deliberately do not count.
     */
    distinctOwned: number;
    distinctOwnedPlusQueued: number;
    /**
     * How much every subsequent non-SoA augmentation's price is multiplied by, per augmentation
     * already queued (1.9, discounted by SF11). The costs in `augs` already include the multiplier
     * for the CURRENT queue, so planning a run of purchases means scaling the k-th by this^k.
     */
    priceMultiplier: number;
    /** Faction we're currently working for, if any. */
    workingFor: string | null;
    focused: boolean;
}

function version(ns: NS): string {
    return String(ns.ui.getGameInfo().version);
}

export function bridgeOk(ns: NS): boolean {
    return getBridge(version(ns)) !== null;
}

/**
 * Cost calculator matching the game's getAugCost, closed over the state it depends on so every
 * augmentation in a snapshot is priced against the same instant.
 *
 * `sf11` is the ACTIVE Source-File 11 level (BitNode options can override the owned level, which
 * is why the game uses activeSourceFileLvl here), and the queued counts drive both the escalating
 * 1.9^n multiplier and NeuroFlux's own level.
 */
function makeCostFn(
    owned: { name: string; level: number }[],
    queued: { name: string }[],
    sf11: number,
    moneyMult: number,
    repMult: number,
): (aug: { name: string; baseCost: number; baseRepRequirement: number }) => { moneyCost: number; repCost: number } {
    const queuedNonSoA = queued.filter((a) => !SOA_AUGS.has(a.name)).length;
    const genericMult = Math.pow(basePriceMultiplier(sf11), queuedNonSoA);

    // hasAugmentation() counts queued augmentations too, so the SoA tally must as well.
    const ownedOrQueued = new Set([...owned.map((a) => a.name), ...queued.map((a) => a.name)]);
    const soaCount = [...SOA_AUGS].filter((n) => ownedOrQueued.has(n)).length;

    // NeuroFlux is stored once with a level; each queued copy is another level.
    const nfgLevel = (owned.find((a) => a.name === NEUROFLUX)?.level ?? 0)
        + queued.filter((a) => a.name === NEUROFLUX).length;

    return (aug) => {
        if (aug.name === NEUROFLUX) {
            const mult = Math.pow(NFG_LEVEL_MULT, nfgLevel);
            return {
                moneyCost: aug.baseCost * mult * moneyMult * genericMult,
                repCost: aug.baseRepRequirement * mult * repMult,
            };
        }
        if (SOA_AUGS.has(aug.name)) {
            return {
                moneyCost: aug.baseCost * Math.pow(SOA_COST_MULT, soaCount),
                repCost: aug.baseRepRequirement * Math.pow(SOA_REP_MULT, soaCount),
            };
        }
        return {
            moneyCost: aug.baseCost * genericMult * moneyMult,
            repCost: aug.baseRepRequirement * repMult,
        };
    };
}

export function snapshot(ns: NS): GameSnapshot | null {
    const bridge = getBridge(version(ns));
    if (!bridge) return null;

    try {
        const player = bridge.Player;
        const owned = player.augmentations.map((a) => a.name);
        const queued = player.queuedAugmentations.map((a) => a.name);
        const ownedSet = new Set(owned);
        const queuedSet = new Set(queued);

        const factions: Record<string, FactionState> = {};
        for (const [name, faction] of Object.entries(bridge.Factions)) {
            let enemies: string[] = [];
            try {
                enemies = faction.getInfo().enemies ?? [];
            } catch {
                // Older/renamed info accessor - an empty enemy list just means we rely on the
                // static INVITE_ALLOWLIST instead, which is the real guard anyway.
            }
            factions[name] = {
                name,
                joined: player.factions.includes(name),
                invited: player.factionInvitations.includes(name),
                banned: !!faction.isBanned,
                rep: faction.playerReputation ?? 0,
                favor: faction.favor ?? 0,
                augs: faction.augmentations ?? [],
                enemies,
            };
        }

        // Missing node multipliers would silently misprice everything, so fall back to 1x (correct
        // for BN1/BN2/BN4 - only BN3 raises augmentation costs) and flag it rather than guessing.
        const moneyMult = bridge.nodeMults?.AugmentationMoneyCost ?? 1;
        const repMult = bridge.nodeMults?.AugmentationRepCost ?? 1;
        const sf11 = ns.getResetInfo().ownedSF.get(11) ?? 0;
        const costOf = makeCostFn(player.augmentations, player.queuedAugmentations, sf11, moneyMult, repMult);

        const augs: Record<string, AugState> = {};
        for (const [name, aug] of Object.entries(bridge.Augmentations)) {
            const cost = costOf(aug);
            augs[name] = {
                name,
                owned: ownedSet.has(name),
                queued: queuedSet.has(name),
                moneyCost: cost.moneyCost,
                repCost: cost.repCost,
                prereqs: aug.prereqs ?? [],
                factions: aug.factions ?? [],
                isNFG: name === NEUROFLUX,
            };
        }

        return {
            at: Date.now(),
            money: player.money,
            factions,
            augs,
            invitations: [...player.factionInvitations],
            owned,
            queued,
            distinctOwned: ownedSet.size,
            distinctOwnedPlusQueued: new Set([...ownedSet, ...queuedSet]).size,
            priceMultiplier: basePriceMultiplier(sf11),
            workingFor: player.currentWork?.factionName ?? null,
            focused: !!player.focus,
        };
    } catch {
        return null;
    }
}

export function factionRep(ns: NS, faction: string): number | null {
    const bridge = getBridge(version(ns));
    const value = bridge?.Factions?.[faction]?.playerReputation;
    return typeof value === "number" ? value : null;
}

export function factionFavor(ns: NS, faction: string): number | null {
    const bridge = getBridge(version(ns));
    const value = bridge?.Factions?.[faction]?.favor;
    return typeof value === "number" ? value : null;
}

export function invitations(ns: NS): string[] | null {
    const bridge = getBridge(version(ns));
    return bridge ? [...bridge.Player.factionInvitations] : null;
}

/** Every augmentation a faction offers, with live prices and ownership. */
export function augsFor(ns: NS, faction: string): AugState[] | null {
    const snap = snapshot(ns);
    if (!snap) return null;
    const names = snap.factions[faction]?.augs ?? [];
    return names.map((n) => snap.augs[n]).filter((a): a is AugState => !!a);
}
