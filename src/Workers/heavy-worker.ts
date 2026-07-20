import { NS } from "@ns";
import { romanToInt, tryPasswords } from "lib/dnet-auth";

// Factori-Os passwords are a random product of primes with no leaking hint, but the exact digit
// count is known via passwordLength. Above this many digits the brute-force range gets too large to be worth it.
const MAX_BRUTE_FORCE_DIGITS = 4;

/** Reads server logs via heartbleed, looking for a password the server occasionally leaks in its own noise. */
async function sniffLeakedPassword(ns: NS, neighbor: string): Promise<string | null> {
    const res = await ns.dnet.heartbleed(neighbor, { logsToCapture: 5 });
    if (!res.success) return null;

    for (const line of res.logs) {
        const match = line.match(/Logging in with passcode:\s*(\S+)/);
        if (match) return match[1];
    }
    return null;
}

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
            else if (details.modelId === "Factori-Os") {
                const length = details.passwordLength;
                if (length > 0 && length <= MAX_BRUTE_FORCE_DIGITS) {
                    const min = 10 ** (length - 1);
                    const max = 10 ** length;
                    candidates = Array.from({ length: max - min }, (_, i) => (min + i).toString());
                }
            }
            else if (details.modelId === "OpenWebAccessPoint") {
                if (details.requiredCharismaSkill <= ns.getPlayer().skills.charisma) {
                    const leaked = await sniffLeakedPassword(ns, neighbor);
                    if (leaked !== null) {
                        candidates = [leaked];
                    }
                }
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