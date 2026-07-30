import {NS} from "@ns";

/** True when Singularity (ns.singularity.*) is usable: in BitNode-4, or owning SF-4. */
export function hasSingularityAccess(ns: NS): boolean {
    const resetInfo = ns.getResetInfo();
    return resetInfo.currentNode === 4 || resetInfo.ownedSF.has(4);
}
