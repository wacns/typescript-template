import {NS} from "@ns";
import {ensureRootAccess} from "lib/root-access";
import {hasSingularityAccess} from "lib/singularity-access";

async function tryBackdoor(ns: NS, target: string): Promise<void> {
    const server = ns.getServer(target);

    if (server.purchasedByPlayer || server.backdoorInstalled) return;

    if (!ensureRootAccess(ns, target)) {
        ns.tprint(`SKIPPED: Could not gain root access on ${target}, cannot install backdoor.`);
        return;
    }

    // ensureRootAccess is not level-gated (nuke isn't either), but installBackdoor is: it throws
    // when the level is too low, which would abort the whole DFS and leave the terminal parked on a
    // remote server. Checked after rooting, so an out-of-reach server still gets rooted on the way past.
    const requiredLevel = server.requiredHackingSkill ?? 0;
    if (requiredLevel > ns.getHackingLevel()) {
        ns.tprint(`SKIPPED: ${target} requires hacking level ${requiredLevel}, cannot install backdoor yet.`);
        return;
    }

    ns.singularity.connect(target);

    ns.tprint(`Installing backdoor on ${target}...`);
    await ns.singularity.installBackdoor();
    ns.tprint(`SUCCESS: Backdoor installed on ${target}!`);
}

// DFS via ns.singularity.connect, since connect() can only move to a neighbor of the current position.
// Always leaves the terminal back at `current` once it returns, so siblings can be reached in turn.
async function scanAndBackdoor(ns: NS, current: string, depth: number, maxDepth: number, visited: Set<string>): Promise<void> {
    visited.add(current);

    if (current !== "home") {
        await tryBackdoor(ns, current);
    }

    if (maxDepth !== -1 && depth >= maxDepth) return;

    for (const neighbor of ns.scan(current)) {
        if (visited.has(neighbor)) continue;

        ns.singularity.connect(neighbor);
        await scanAndBackdoor(ns, neighbor, depth + 1, maxDepth, visited);
        ns.singularity.connect(current);
    }
}

export async function main(ns: NS): Promise<void> {
    const rawDepth = ns.args[0];
    const depth = typeof rawDepth === "number" ? rawDepth : parseInt(String(rawDepth), 10);

    if (rawDepth === undefined || isNaN(depth) || (depth < 0 && depth !== -1)) {
        ns.tprint("Please specify a depth: a non-negative number, or -1 for unlimited. e.g. run ScanInstallBackdoor.js 5");
        return;
    }

    if (!hasSingularityAccess(ns)) {
        ns.tprint("SKIPPED: This script needs Source-File 4 (or being in BitNode 4) to use ns.singularity.connect/installBackdoor.");
        return;
    }

    await scanAndBackdoor(ns, "home", 0, depth, new Set<string>());

    ns.tprint("Backdoor scan complete.");
}
