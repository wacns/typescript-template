import { NS } from "@ns";

/**
 * BFS-scans the whole network reachable from home, returning every hostname found (including home),
 * plus every purchased cloud server. Cloud servers are bought/managed through the separate ns.cloud
 * API and don't appear as ns.scan() neighbors of home, so they'd otherwise never be picked up as
 * deploy targets even though they're owned and rootable.
 */
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

    for (const cloudServer of ns.cloud.getServerNames()) {
        if (!knownServers.has(cloudServer)) {
            knownServers.add(cloudServer);
            serversToScan.push(cloudServer);
        }
    }

    return serversToScan;
}
