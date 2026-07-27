import {NS} from "@ns";
import {scanAllServers} from "lib/network-scan";

/**
 * Scores every rooted, non-owned, in-range server by (maxMoney * hackChance / weakenTime) and
 * returns the best hostname, or "" if none qualify yet.
 */
export async function main(ns: NS): Promise<void> {
    const player = ns.getPlayer();
    const hasFormulas = ns.fileExists("Formulas.exe", "home");
    let best = "";
    let bestScore = -Infinity;

    for (const hostname of scanAllServers(ns)) {
        if (hostname === "home") continue;
        const server = ns.getServer(hostname);
        if (!server.hasAdminRights || server.purchasedByPlayer || !server.moneyMax) continue;
        if ((server.requiredHackingSkill ?? 0) > player.skills.hacking) continue;

        const hackChance = hasFormulas ? ns.formulas.hacking.hackChance(server, player) : ns.hackAnalyzeChance(hostname);
        const weakenTime = hasFormulas ? ns.formulas.hacking.weakenTime(server, player) : ns.getWeakenTime(hostname);
        if (weakenTime <= 0) continue;

        const score = (server.moneyMax * hackChance) / weakenTime;
        if (score > bestScore) {
            bestScore = score;
            best = hostname;
        }
    }

    ns.atExit(() => ns.writePort(ns.pid, best));
}
