import { NS } from "@ns";
import { ALL_FACTIONS, describeRequirement, tryAutoSatisfy } from "lib/faction-requirements";

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    ns.clearLog();

    let hasSingularity = false;
    try {
        const ownedSF = ns.singularity.getOwnedSourceFiles();
        hasSingularity = ownedSF.some(sf => sf.n === 4) || ns.getResetInfo().currentNode === 4;
    } catch (e) {
        ns.tprint(`[WARNING] Could not determine Singularity access. Error: ${e}`);
    }

    if (!hasSingularity) {
        ns.tprint("[STOPPED] Faction manager requires Singularity access (Source-File 4 or BitNode 4).");
        return;
    }

    ns.tprint("[START] Faction auto-joiner/unlocker online.");

    // eslint-disable-next-line no-constant-condition
    while (true) {
        // 1. Auto-join any pending invitations
        const invites = ns.singularity.checkFactionInvitations();
        for (const faction of invites) {
            if (ns.singularity.joinFaction(faction)) {
                ns.tprint(`[JOINED] ${faction}`);
            }
        }

        // 2. Work toward the requirements of every faction not yet joined
        const joined = new Set(ns.getPlayer().factions);
        const statusLines: string[] = [];

        for (const faction of ALL_FACTIONS) {
            if (joined.has(faction)) continue;

            let reqs;
            try {
                reqs = ns.singularity.getFactionInviteRequirements(faction);
            } catch {
                continue; // some factions aren't obtainable via the normal invite path
            }
            if (reqs.length === 0) continue;

            const missing: string[] = [];
            for (const req of reqs) {
                if (!(await tryAutoSatisfy(ns, req))) {
                    missing.push(describeRequirement(req));
                }
            }

            statusLines.push(
                missing.length > 0
                    ? `${faction}: needs ${missing.join(" | ")}`
                    : `${faction}: requirements met, waiting on invite`
            );
        }

        ns.clearLog();
        ns.print("=========================================");
        ns.print("🏛️ FACTION MANAGER 🏛️");
        ns.print("=========================================");
        ns.print(`✅ Joined (${joined.size}): ${[...joined].join(", ") || "none"}`);
        ns.print("-----------------------------------------");
        for (const line of statusLines) {
            ns.print(line);
        }
        ns.print("=========================================");

        await ns.sleep(30000);
    }
}
