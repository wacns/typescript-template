import {NS} from "@ns";

const MIN_RAM_EXP = 1; // lowest RAM a cloud server can be purchased with is 2**1 GB
const MAX_RAM_EXP = 20; // highest RAM a cloud server can have is 2**20 GB

/**
 * Steps a server's RAM through 2**x for x = 1..20, applying every upgrade that's affordable, up to maxRam.
 * @returns the RAM the server ended up with, and the money left over after all affordable upgrades.
 */
function upgradeToMax(ns: NS, server: string, currentRam: number, maxRam: number, money: number): {
    finalRam: number,
    money: number
} {
    let ram = currentRam;

    for (let x = MIN_RAM_EXP; x <= MAX_RAM_EXP; x++) {
        const nextRam = 2 ** x;

        if (nextRam <= ram || nextRam > maxRam) {
            continue;
        }

        const cost = ns.cloud.getServerUpgradeCost(server, nextRam);

        if (cost === -1 || cost > money) {
            break;
        }

        if (!ns.cloud.upgradeServer(server, nextRam)) {
            break;
        }

        money -= cost;
        ram = nextRam;
    }

    return {finalRam: ram, money};
}

export async function main(ns: NS): Promise<void> {

    if (ns.args.length > 1) {
        ns.tprint("Usage: run purchase-cloud-servers.js [maxPurchases] (omit to disable purchasing; -1 for unlimited)");
        return;
    }

    const maxPurchases = ns.args[0] === undefined ? undefined : Number(ns.args[0]);
    const allowPurchase = maxPurchases !== undefined;
    const maxRam = ns.cloud.getRamLimit();

    if (allowPurchase && maxPurchases < -1) {
        ns.tprint("maxPurchases must be -1 (unlimited) or a non-negative number.");
        return;
    }

    let money = ns.getServerMoneyAvailable("home");

    const serverNames = ns.cloud.getServerNames()
        .map(server => ({server, ram: ns.getServerMaxRam(server)}))
        .sort((a, b) => a.ram - b.ram); // weakest servers first

    for (const {server, ram} of serverNames) {
        const result = upgradeToMax(ns, server, ram, maxRam, money);
        money = result.money;

        if (result.finalRam !== ram) {
            ns.tprint(`Upgraded server:\nHostname: ${server}\nRAM: ${ram}GB -> ${result.finalRam}GB`);
        }
    }

    if (!allowPurchase) {
        return;
    }

    const serverLimit = ns.cloud.getServerLimit();
    let purchasedCount = serverNames.length;
    let purchasesThisRun = 0;
    const minRam = 2 ** MIN_RAM_EXP;

    while (purchasedCount < serverLimit && (maxPurchases === -1 || purchasesThisRun < maxPurchases!)) {
        const cost = ns.cloud.getServerCost(minRam);

        if (cost > money) {
            break;
        }

        const serverName = `wacns-cs-${purchasedCount + 1}`;
        const purchasedServer = ns.cloud.purchaseServer(serverName, minRam);

        if (purchasedServer === "") {
            break;
        }

        money -= cost;
        purchasedCount++;
        purchasesThisRun++;

        const result = upgradeToMax(ns, purchasedServer, minRam, maxRam, money);
        money = result.money;

        ns.tprint(`Purchased server:\nHostname: ${purchasedServer}\nRAM: ${result.finalRam}GB`);
    }
}
