import { NS } from "@ns";

/** BFS-scans the whole network reachable from home, returning every hostname found (including home). */
export function scanAllServers(ns: NS): string[] {
    const serversToScan = ["home"];
    const knownServers = new Set(["home"]);

    for (let i = 0; i < serversToScan.length; i++) {
        for (const nextServer of ns.scan(serversToScan[i])) {
            if (!knownServers.has(nextServer)) {
                knownServers.add(nextServer);
                serversToScan.push(nextServer);
            }
        }
    }

    return serversToScan;
}
