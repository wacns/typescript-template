/**
 * The webpack read-bridge: reaches the game's live internal objects so the autopilot can read
 * what ns.singularity.* would otherwise tell it (faction rep and favor, pending invitations,
 * augmentation prices and rep requirements, owned/queued augs). None of that is exposed to
 * Netscript without Source-File 4 - ns.getPlayer() has no augmentations, no rep, no invites.
 *
 * The bootstrap is the pattern already proven in this repo by src/Utils/quickWD.ts and
 * src/Utils/exploitAll.ts: push a fake chunk to capture webpack's require, skip the entry
 * chunk's own module ids, then walk every remaining module looking for objects whose SHAPE we
 * recognize. Fingerprinting by shape rather than by module id or minified name is what makes
 * this survive a rebuild of the game.
 *
 * Cached on globalThis so the scan (which touches every module) happens once per session rather
 * than once per tick.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {BridgeAugmentation, BridgeFaction, BridgeNodeMults, BridgePlayer, BridgeRNG, WacnBridge} from "WacnOS/bridge/types";

const CACHE_KEY = "__wacnBridge";

/** A well-known faction and augmentation, used as probes when identifying the registries. */
const PROBE_FACTION = "Daedalus";
const PROBE_AUG = "NeuroFlux Governor";

function global(): any {
    return globalThis as any;
}

function exposeWebpackRequire(): any | null {
    const g = global();
    if (g.webpackRequire) return g.webpackRequire;
    const chunk = g.webpackChunkbitburner;
    if (!chunk) return null;
    chunk.push([[-1], {}, (w: unknown) => (g.webpackRequire = w)]);
    return g.webpackRequire ?? null;
}

function isPlayer(value: any): value is BridgePlayer {
    // The exploitAll.ts pair identifies the PlayerObject; the rest confirms it's the live one
    // and not some prototype or serialized copy.
    return !!value
        && Array.isArray(value.exploits)
        && typeof value.giveExploit === "function"
        && Array.isArray(value.factionInvitations)
        && Array.isArray(value.queuedAugmentations)
        && Array.isArray(value.factions);
}

function isFactionRegistry(value: any): value is Record<string, BridgeFaction> {
    if (!value || typeof value !== "object") return false;
    const known = value[PROBE_FACTION];
    return !!known
        && typeof known.playerReputation === "number"
        && typeof known.alreadyInvited === "boolean"
        && Array.isArray(known.augmentations);
}

function isAugmentationRegistry(value: any): value is Record<string, BridgeAugmentation> {
    if (!value || typeof value !== "object") return false;
    const known = value[PROBE_AUG];
    return !!known
        && typeof known.baseCost === "number"
        && typeof known.baseRepRequirement === "number"
        && Array.isArray(known.prereqs);
}

function isRouter(value: any): boolean {
    return !!value && typeof value.toPage === "function" && typeof value.page === "function";
}

/**
 * The live BitNodeMultipliers instance.
 *
 * Recognized by instance shape rather than by export name: webpack mangles export bindings in a
 * production build, but class field names survive (renaming those would break save round-trips),
 * which is the same reason quickWD.ts walks Object.values instead of looking up keys.
 */
function isNodeMults(value: any): value is BridgeNodeMults {
    return !!value
        && typeof value.AugmentationMoneyCost === "number"
        && typeof value.AugmentationRepCost === "number"
        && typeof value.ScriptHackMoney === "number"
        && typeof value.HackingLevelMultiplier === "number";
}

/**
 * The casino's coin-flip RNG. Identified by its own constants (m/a/c), which is about as
 * distinctive a fingerprint as exists in the codebase.
 */
function isBadRNG(value: any): value is BridgeRNG {
    return !!value
        && value.m === 1024
        && value.a === 341
        && value.c === 1
        && typeof value.x === "number"
        && typeof value.random === "function";
}

function build(version: string): WacnBridge | null {
    const require = exposeWebpackRequire();
    if (!require) return null;

    const g = global();
    const skipped = new Set(Object.keys(g.webpackChunkbitburner[0][1]));
    const ids = Object.keys(require.m).filter((id: string) => !skipped.has(id));

    let Player: BridgePlayer | null = null;
    let Factions: Record<string, BridgeFaction> | null = null;
    let Augmentations: Record<string, BridgeAugmentation> | null = null;
    let Router: WacnBridge["Router"] = null;
    let nodeMults: BridgeNodeMults | null = null;
    let BadRNG: BridgeRNG | null = null;

    for (const id of ids) {
        let mod: any;
        try {
            mod = require(id);
        } catch {
            continue;
        }
        if (!mod) continue;

        for (const value of Object.values(mod)) {
            if (!Player && isPlayer(value)) Player = value;
            else if (!Factions && isFactionRegistry(value)) Factions = value as Record<string, BridgeFaction>;
            else if (!Augmentations && isAugmentationRegistry(value)) Augmentations = value as Record<string, BridgeAugmentation>;
            else if (!nodeMults && isNodeMults(value)) nodeMults = value;
            else if (!BadRNG && isBadRNG(value)) BadRNG = value;
            else if (!Router && isRouter(value)) Router = value as WacnBridge["Router"];
        }
    }

    if (!Player || !Factions || !Augmentations) return null;

    return {
        builtAt: Date.now(),
        version,
        node: Player.bitNodeN,
        Player,
        Factions,
        Augmentations,
        nodeMults,
        BadRNG,
        Router,
    };
}

/** Cheap per-call sanity check that a cached bridge still points at live objects. */
function stillValid(bridge: WacnBridge | null, version: string): bridge is WacnBridge {
    if (!bridge) return false;
    // A game update can invalidate the fingerprints entirely.
    if (bridge.version !== version) return false;
    try {
        // The live Player reports the current BitNode, so the bridge can notice its own captured
        // currentNodeMults has gone stale without the caller having to spend 1GB on getResetInfo.
        if (bridge.Player.bitNodeN !== bridge.node) return false;
        return typeof bridge.Factions[PROBE_FACTION]?.playerReputation === "number"
            && Array.isArray(bridge.Player.factionInvitations);
    } catch {
        return false;
    }
}

/**
 * The bridge, building it on first use and reusing it afterwards.
 *
 * `version` is passed in rather than read from `ns` so this file stays free of any Netscript
 * dependency (and therefore of RAM cost), while still forcing a rebuild after a game update
 * instead of serving a bridge whose fingerprints may no longer mean what they did.
 */
export function getBridge(version: string): WacnBridge | null {
    const g = global();
    const cached = g[CACHE_KEY] as WacnBridge | undefined;
    if (stillValid(cached ?? null, version)) return cached as WacnBridge;
    return rebuildBridge(version);
}

export function rebuildBridge(version: string): WacnBridge | null {
    const bridge = build(version);
    global()[CACHE_KEY] = bridge ?? undefined;
    return bridge;
}

/** The game's page Router, if the bridge has it. Navigation only - see dom/nav.ts tier 3. */
export function getRouter(version: string): WacnBridge["Router"] {
    return getBridge(version)?.Router ?? null;
}
