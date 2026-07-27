import {NS} from "@ns";

const STARTING_RAM = 8;

/**
 * Minimal auto-buy: purchase a new cloud server at STARTING_RAM if under the server limit and
 * affordable, otherwise try doubling the smallest owned one's RAM if affordable. Returns true if
 * it bought/upgraded anything this pass.
 */
export async function main(ns: NS): Promise<void> {
    const owned = ns.cloud.getServerNames();
    const money = ns.getServerMoneyAvailable("home");
    let acted = false;

    if (owned.length < ns.cloud.getServerLimit()) {
        const cost = ns.cloud.getServerCost(STARTING_RAM);
        if (money >= cost) {
            acted = ns.cloud.purchaseServer("wacn-", STARTING_RAM) !== "";
        }
    } else {
        let smallest = "";
        let smallestRam = Infinity;
        for (const hostname of owned) {
            const ram = ns.getServerMaxRam(hostname);
            if (ram < smallestRam) {
                smallestRam = ram;
                smallest = hostname;
            }
        }
        if (smallest && Number.isFinite(smallestRam)) {
            const nextRam = smallestRam * 2;
            const cost = ns.cloud.getServerUpgradeCost(smallest, nextRam);
            if (cost >= 0 && money >= cost) {
                acted = ns.cloud.upgradeServer(smallest, nextRam);
            }
        }
    }

    ns.atExit(() => ns.writePort(ns.pid, acted));
}
