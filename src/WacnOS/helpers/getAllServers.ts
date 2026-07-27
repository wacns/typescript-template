import {NS} from "@ns";
import {scanAllServers} from "lib/network-scan";

/** Returns every reachable Server object (network + purchased/cloud), so hackloop.ts can sum available RAM without statically paying for ns.getServer/ns.scan/ns.cloud itself. */
export async function main(ns: NS): Promise<void> {
    const servers = scanAllServers(ns).map((hostname) => ns.getServer(hostname));
    ns.atExit(() => ns.writePort(ns.pid, servers));
}
