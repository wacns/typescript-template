import {NS} from "@ns";
import {scanAllServers} from "lib/network-scan";
import {ensureRootAccess} from "lib/root-access";

/**
 * Roots every reachable server not yet rooted, as hacking level and owned cracker programs allow.
 * Reuses this repo's own lib/network-scan + lib/root-access (generic, not SphyxOS/Dispatchers-specific)
 * rather than reimplementing scan/nuke logic. Returns how many servers were newly rooted this pass.
 */
export async function main(ns: NS): Promise<void> {
    const hackingLevel = ns.getHackingLevel();
    let rooted = 0;
    for (const hostname of scanAllServers(ns)) {
        if (ns.hasRootAccess(hostname)) continue;
        // Pre-filter by level so ensureRootAccess's own tprint warnings don't fire every cycle
        // for servers we simply aren't ready for yet.
        if (ns.getServerRequiredHackingLevel(hostname) > hackingLevel) continue;
        if (ensureRootAccess(ns, hostname)) rooted++;
    }
    ns.atExit(() => ns.writePort(ns.pid, rooted));
}
