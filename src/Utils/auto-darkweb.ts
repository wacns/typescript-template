import { NS, ProgramName } from "@ns";

/** @param {NS} ns */
export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.clearLog();

    ns.print("[START] Darkweb Auto-Buyer Daemon Online.");

    while (true) {
        const myMoney = ns.getServerMoneyAvailable("home");

        // 1. Buy TOR Router if we don't have it yet (Costs $200k)
        if (!ns.hasTorRouter()) {
            // We use 200,000 as a safe threshold
            if (myMoney >= 200000) {
                const bought = ns.singularity.purchaseTor();
                if (bought) {
                    ns.print("🌐 Successfully purchased TOR Router!");
                }
            }
        }

        // 2. If we have TOR, scan the darkweb for missing programs and buy them
        if (ns.hasTorRouter()) {
            const availablePrograms = ns.singularity.getDarkwebPrograms();

            for (const prog of availablePrograms) {
                // If we don't already own the file on our home computer
                if (!ns.fileExists(prog, "home")) {
                    const cost = ns.singularity.getDarkwebProgramCost(prog);

                    // If we can afford it, buy it instantly
                    if (myMoney >= cost) {
                        const success = ns.singularity.purchaseProgram(prog);
                        if (success) {
                            ns.print(`🔓 Purchased ${prog} for $${ns.format.number(cost)}`);
                        }
                    }
                }
            }
        }

        // Sleep for 5 seconds before checking finances again
        await ns.sleep(5000);
    }
}