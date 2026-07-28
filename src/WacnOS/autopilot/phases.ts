/**
 * The BitNode 1 ladder and its constants.
 *
 * Every requirement here was read out of the game's own Faction/FactionInfo.tsx rather than
 * inferred, because getting one wrong doesn't fail loudly - it just leaves the autopilot waiting
 * forever for an invite that will never come.
 */

/**
 * Faction order for BN1. The union of these factions' augmentations is 37 distinct, comfortably
 * over the 30 Daedalus requires, and every one of them is reachable through hacking, hacknet or
 * travel - no crime, combat or company work anywhere on this path.
 *
 * Ordered by when each becomes attainable rather than by value: the backdoor factions gate on
 * hacking level, the city factions on money.
 */
export const BN1_LADDER = [
    "CyberSec",       // backdoor CSEC
    "Tian Di Hui",    // Ishima/Chongqing/New Tokyo + hacking 50 + $1m
    "NiteSec",        // backdoor avmnite-02h
    "The Black Hand", // backdoor I.I.I.I
    "BitRunners",     // backdoor run4theh111z
    "Netburners",     // hacking 80 + hacknet levels/ram/cores
    "Sector-12",      // in Sector-12 + $15m
    "Aevum",          // in Aevum + $40m
] as const;

/**
 * The ONLY factions the autopilot may ever join.
 *
 * This is the single most important safety rule in the project. Chongqing, New Tokyo, Ishima and
 * Volhaven each list Sector-12 and Aevum as enemies (FactionInfo.tsx:508-553), and joinFaction
 * permanently bans every enemy of whatever you join (FactionHelpers.tsx:45-47). Joining one city
 * faction by accident therefore costs two ladder factions and their augmentations - which can put
 * the 30-augmentation Daedalus gate out of reach for the entire run.
 *
 * Note that Sector-12 and Aevum are NOT enemies of each other, so both are safe to hold.
 *
 * A pending invite costs nothing. We simply never accept the ones that aren't here - and travelling
 * to Ishima for Tian Di Hui will eventually produce an Ishima invite once money passes $30m, so
 * this case is guaranteed to come up rather than being theoretical.
 */
export const INVITE_ALLOWLIST: ReadonlySet<string> = new Set<string>([...BN1_LADDER, "Daedalus"]);

/** Factions unlocked purely by backdooring a server (FactionInfo.tsx:402,419,464,489). */
export const BACKDOOR_FACTIONS: Record<string, string> = {
    CyberSec: "CSEC",
    NiteSec: "avmnite-02h",
    "The Black Hand": "I.I.I.I",
    BitRunners: "run4theh111z",
};

/** Factions unlocked by standing in a city with enough money. */
export const CITY_FACTIONS: Record<string, { cities: string[]; money: number; hacking: number }> = {
    // Tian Di Hui accepts any of three cities; Ishima is the usual choice since it also has a
    // tech vendor for TOR and home RAM.
    "Tian Di Hui": {cities: ["Ishima", "Chongqing", "New Tokyo"], money: 1e6, hacking: 50},
    "Sector-12": {cities: ["Sector-12"], money: 15e6, hacking: 0},
    Aevum: {cities: ["Aevum"], money: 40e6, hacking: 0},
};

/** Netburners' hacknet thresholds (FactionInfo.tsx:675). */
export const NETBURNERS_REQ = {
    hacking: 80,
    levels: 100,
    ram: 8,
    cores: 4,
};

/** The BN1 endgame gates. */
export const DAEDALUS = {
    /** Distinct INSTALLED augmentations; NeuroFlux counts once. currentNodeMults.DaedalusAugsRequirement, 30 in BN1-4. */
    augs: 30,
    money: 100e9,
    hacking: 2500,
    /** Combat alternative to the hacking requirement - not the path this autopilot takes. */
    combat: 1500,
    redPill: "The Red Pill",
    redPillRep: 2.5e6,
};

/** The World Daemon. Required hacking is 3000 x WorldDaemonDifficulty (1 in BN1, 3 in BN4). */
export const WORLD_DAEMON = {
    host: "w0r1d_d43m0n",
    gateway: "The-Cave",
    baseHacking: 3000,
    ports: 5,
};

/** Favor needed before donating to a faction is possible (CONSTANTS.BaseFavorToDonate). */
export const FAVOR_TO_DONATE = 150;

/** Money the casino tops out at per augmentation install (Casino/Game.ts gainLimit). */
export const CASINO_LIMIT = 10e9;

export function worldDaemonHacking(bitNode: number): number {
    const difficulty: Record<number, number> = {1: 1, 2: 5, 3: 2, 4: 3};
    return WORLD_DAEMON.baseHacking * (difficulty[bitNode] ?? 1);
}
