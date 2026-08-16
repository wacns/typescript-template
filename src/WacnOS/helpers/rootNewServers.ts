import {NS} from "@ns";
import {scanAllServers} from "lib/network-scan";
import {ensureRootAccess} from "lib/root-access";

/**
 * Roots every reachable server not yet rooted, as the owned cracker programs allow. Hacking level is
 * not a condition - ns.nuke() does not check it - so high-required-level, large-RAM hosts get rooted
 * as soon as the crackers exist, and become available as drone capacity.
 * Reuses this repo's own lib/network-scan + lib/root-access (generic, not SphyxOS/Dispatchers-specific)
 * rather than reimplementing scan/nuke logic. Returns how many servers were newly rooted this pass.
 */
export async function main(ns: NS): Promise<void> {
    let rooted = 0;
    for (const hostname of scanAllServers(ns)) {
        if (ns.hasRootAccess(hostname)) continue;
        if (ensureRootAccess(ns, hostname)) rooted++;
    }
    ns.atExit(() => ns.writePort(ns.pid, rooted));
}
