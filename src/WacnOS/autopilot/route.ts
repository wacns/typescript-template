import {NS} from "@ns";
import {RouteId, WacnOSConfig} from "WacnOS/config";

/** One leg of a route: keep entering `bn` until we own its Source-File at `targetLevel`. */
export interface RouteStep {
    bn: number;
    targetLevel: number;
}

/**
 * The selectable BitNode progressions, in the same spirit as SphyxOS's `bnorder` table
 * (src/SphyxOS/bins/autopilot.js), but short and purpose-built: every route here exists to
 * reach Source-File 4, since that's what unlocks Singularity and therefore every other
 * autopilot in this repo.
 *
 * BN2/BN3 are deliberately not on the default path - neither grants anything needed for SF4,
 * BN2's World Daemon wants 15000 hacking (WorldDaemonDifficulty 5) and BN3 triples both
 * augmentation money and rep costs.
 */
export const ROUTES: Record<RouteId, RouteStep[]> = {
    "bn1-to-bn4": [{bn: 4, targetLevel: 1}],
    "bn1-2-3-4": [{bn: 2, targetLevel: 1}, {bn: 3, targetLevel: 1}, {bn: 4, targetLevel: 1}],
    // Max out SF1 first (+16% hacking money/exp per level) so BN4's brutal 0.1125 x 0.2 money
    // multiplier lands on a stronger character.
    "farm-bn1-sf13": [{bn: 1, targetLevel: 3}, {bn: 4, targetLevel: 1}],
    custom: [],
};

export const ROUTE_IDS: RouteId[] = ["bn1-to-bn4", "bn1-2-3-4", "farm-bn1-sf13", "custom"];

export const ROUTE_LABELS: Record<RouteId, string> = {
    "bn1-to-bn4": "bn1 -> bn4",
    "bn1-2-3-4": "bn1-2-3-4",
    "farm-bn1-sf13": "farm sf1.3",
    custom: "custom",
};

function stepsFor(cfg: WacnOSConfig): RouteStep[] {
    if (cfg.route !== "custom") return ROUTES[cfg.route];
    return cfg.customRoute.map((bn) => ({bn, targetLevel: 1}));
}

/**
 * The BitNode to take at the next BitVerse portal, mirroring SphyxOS's getNextBN
 * (src/SphyxOS/bins/autopilot.js): walk the route and return the first step we haven't
 * satisfied yet.
 *
 * The +1 matters - destroying the node you're currently in grants a Source-File level the
 * moment you take a portal, so a step targeting the current node is already met if finishing
 * this run would meet it. Without that, "farm-bn1-sf13" would re-enter BN1 one time too many.
 */
export function nextBitNode(ns: NS, cfg: WacnOSConfig): number {
    const reset = ns.getResetInfo();
    const steps = stepsFor(cfg);

    for (const step of steps) {
        const owned = reset.ownedSF.get(step.bn) ?? 0;
        const pending = reset.currentNode === step.bn ? 1 : 0;
        if (owned + pending < step.targetLevel) return step.bn;
    }

    // Route exhausted (or empty): default to BN4 if we still lack Singularity, else stay put.
    const sf4 = reset.ownedSF.get(4) ?? 0;
    if (sf4 === 0 && reset.currentNode !== 4) return 4;
    return reset.currentNode;
}

export function routeLabel(cfg: WacnOSConfig): string {
    return ROUTE_LABELS[cfg.route] ?? String(cfg.route);
}
