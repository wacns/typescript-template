import { NS } from "@ns";

const LOG_PORT = 19;
const home = "home";

export async function main(ns: NS): Promise<void> {
    const currentNode = ns.getHostname();

    const sendLog = (message: string) => {
        const formatted = `[${currentNode}] ${message}`;
        if (currentNode === home) {
            ns.tprint(formatted);
        } else {
            ns.tryWritePort(LOG_PORT, formatted);
        }
    };

    ns.disableLog("dnet.memoryReallocation");
    ns.disableLog("dnet.setStasisLink");

    // Reclaim blocked RAM
    try {
        if (ns.dnet.getBlockedRam(currentNode) > 0) {
            await ns.dnet.memoryReallocation(currentNode);
            sendLog(`[RAM] Reclaimed blocked RAM on ${currentNode}`);
        }
    } catch (err) {
        sendLog(`[ERROR] Memory reallocation failed on ${currentNode}: ${err}`);
    }

    // Apply stasis link lock with explicit error logging
    try {
        await ns.dnet.setStasisLink(true);
        sendLog(`[STASIS] Locked down stasis link on ${currentNode}`);
    } catch (e) {
        sendLog(`[STASIS FAIL] Could not apply stasis link on ${currentNode}: ${e}`);
    }
}