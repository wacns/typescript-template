import { NS } from "@ns";
import { romanToInt, tryPasswords } from "lib/dnet-auth";

export async function main(ns: NS): Promise<void> {
    const currentNode = ns.getHostname();
    ns.disableLog("sleep");

    ns.print(`[HEAVY WORKER] Initialized on high-RAM node ${currentNode}. Ready for complex model solving.`);

    while (true) {
        const neighbors: string[] = ns.dnet.probe();
        for (const neighbor of neighbors) {
            const details = ns.dnet.getServerDetails(neighbor);
            if (!details.isConnectedToCurrentServer || !details.isOnline || details.hasSession) {
                continue;
            }

            let candidates: string[] = [];

            if (details.modelId === "BellaCuore") {
                const romanMatch = details.passwordHint.match(/\b([IVXLCDMivxlcdm]+)\b/);
                if (romanMatch) {
                    candidates = [romanToInt(romanMatch[1]).toString()];
                }
            }
            else if (details.modelId === "AccountsManager_4.2") {
                const matches = details.passwordHint.match(/between\s+([0-9]+)\s+and\s+([0-9]+)/i);
                const min = matches ? parseInt(matches[1]) : 0;
                const max = matches ? parseInt(matches[2]) : 100;
                candidates = Array.from({ length: max - min + 1 }, (_, i) => (min + i).toString());
            }

            if (candidates.length > 0) {
                const winner = await tryPasswords(ns, neighbor, candidates);
                if (winner !== null) {
                    ns.print(`[HEAVY SOLVER] Cracked ${neighbor} using advanced solver.`);
                }
            }
        }
        await ns.sleep(15000);
    }
}