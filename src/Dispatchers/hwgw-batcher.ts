import {NS} from "@ns";
import {scanAllServers} from "lib/network-scan";
import {planBatch} from "lib/hwgw-batch";

export const ACTION_SCRIPT = "HackRelated/hwgw-action.js";

/** Greedily packs threadsNeeded across rooted servers (scp-ing the action script where needed). */
function allocateThreads(
    ns: NS, servers: string[], scriptRam: number, threadsNeeded: number, home: string
): { server: string; threads: number }[] {
    const allocation: { server: string; threads: number }[] = [];
    let remaining = threadsNeeded;

    for (const server of servers) {
        if (remaining <= 0) break;
        if (!ns.hasRootAccess(server)) continue;

        if (server !== home) {
            ns.scp(ACTION_SCRIPT, server, home);
        }

        const maxRam = ns.getServerMaxRam(server);
        const usedRam = ns.getServerUsedRam(server);
        let availableRam = maxRam - usedRam;
        if (server === home) {
            availableRam -= Math.max(32, maxRam * 0.1);
        }

        const threadsHere = Math.min(remaining, Math.floor(availableRam / scriptRam));
        if (threadsHere > 0) {
            allocation.push({server, threads: threadsHere});
            remaining -= threadsHere;
        }
    }

    return allocation;
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    ns.clearLog();

    const target = ns.args[0] as string;
    if (!target) {
        ns.tprint("[STOPPED] hwgw-batcher requires a target argument.");
        return;
    }

    const home = "home";
    ns.tprint(`[START] HWGW batcher online, target: ${target}`);

    while (true) {
        const plan = planBatch(ns, target);
        if (plan === null) {
            ns.tprint("[STOPPED] Formulas.exe unavailable (or planning failed) - deploy.js will fall back to a simpler payload next cycle.");
            return;
        }

        const servers = scanAllServers(ns);
        const scriptRam = ns.getScriptRam(ACTION_SCRIPT, home);

        let launched = 0;
        for (const step of plan.steps) {
            const allocation = allocateThreads(ns, servers, scriptRam, step.threads, home);
            for (const {server, threads} of allocation) {
                const pid = ns.exec(ACTION_SCRIPT, server, threads, target, step.action, step.delayMs);
                if (pid > 0) launched++;
            }
        }

        ns.print(`[BATCH] ${target}: launched ${launched} process(es), cycle ${ns.format.time(plan.cycleTimeMs)}`);

        await ns.sleep(plan.cycleTimeMs + 200);
    }
}
