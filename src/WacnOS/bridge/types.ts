/**
 * Shapes of the game's own internal objects, as reached through the webpack bridge.
 *
 * These mirror Bitburner's real classes (PlayerObject, Faction, Augmentation) but only declare
 * the fields WacnOS actually reads. They are NOT the game's types - they're a narrow, defensive
 * view of them, so a field the game renames breaks one fingerprint here instead of the autopilot.
 *
 * Everything in this directory is READ-ONLY by policy. The single exception is Router.toPage,
 * which is navigation, and only ever used as the last fallback behind two DOM tiers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BridgePlayer {
    /** The exploitAll.ts fingerprint pair - how we recognize this object at all. */
    exploits: string[];
    giveExploit: (exploit: string) => void;

    factions: string[];
    factionInvitations: string[];
    /** Installed augmentations. NeuroFlux appears once with an incrementing `level`. */
    augmentations: { name: string; level: number }[];
    /** Bought but not yet installed - these do NOT count toward Daedalus's 30. */
    queuedAugmentations: { name: string; level: number }[];
    money: number;
    currentWork: { factionName?: string; companyName?: string; type?: string } | null;
    focus: boolean;
    /** Current BitNode - lets the bridge detect that its captured node multipliers went stale. */
    bitNodeN: number;
    /** Money earned per source since the last install - what ns.getMoneySources() calls sinceInstall. */
    moneySourceA: { casino: number };
}

/**
 * The casino's coin-flip RNG (Casino/RNG.ts RNG0): a linear congruential generator,
 * x = (341x + 1) mod 1024, seeded from the clock and exported as a module singleton.
 *
 * Reading `x` lets us predict every flip. We must never call random() ourselves - that would
 * advance the sequence and desynchronise us from the game.
 */
export interface BridgeRNG {
    x: number;
    m: number;
    a: number;
    c: number;
    random: () => number;
}

export interface BridgeFaction {
    name: string;
    playerReputation: number;
    favor: number;
    isMember: boolean;
    alreadyInvited: boolean;
    isBanned: boolean;
    augmentations: string[];
    getInfo: () => { enemies: string[]; offerHackingWork: boolean; offerFieldWork: boolean; offerSecurityWork: boolean };
}

export interface BridgeAugmentation {
    name: string;
    baseCost: number;
    baseRepRequirement: number;
    prereqs: string[];
    factions: string[];
    isSpecial: boolean;
}

/** The subset of the game's BitNodeMultipliers that augmentation pricing depends on. */
export interface BridgeNodeMults {
    AugmentationMoneyCost: number;
    AugmentationRepCost: number;
}

export interface WacnBridge {
    builtAt: number;
    /** Game version the bridge was fingerprinted against; a mismatch forces a rebuild. */
    version: string;
    /**
     * BitNode the bridge was built in. The game's `currentNodeMults` is an `export let` that gets
     * REASSIGNED when the node changes (BitNodeMultipliers.ts:188), so a captured reference goes
     * stale across a BitNode switch - hence a rebuild on mismatch rather than a live re-read.
     */
    node: number;
    Player: BridgePlayer;
    Factions: Record<string, BridgeFaction>;
    Augmentations: Record<string, BridgeAugmentation>;
    /** Augmentation cost multipliers for the current BitNode; null if the fingerprint missed. */
    nodeMults: BridgeNodeMults | null;
    /** The casino coin-flip RNG, for predicting flips instead of gambling. */
    BadRNG: BridgeRNG | null;
    Router: { page: () => string; toPage: (page: string, options?: any) => void } | null;
}
