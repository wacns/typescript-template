import {NS} from "@ns";

/**
 * Grows the hacknet toward the Netburners invite thresholds: 100 total levels, 8 total RAM,
 * 4 total cores (plus hacking 80, which the hacking loop handles).
 *
 * Args: [maxSpendFraction] - never spend more than this share of current money in one pass, so
 * calling this repeatedly can't starve augmentation buying.
 *
 * The strategy is deliberately "cheapest useful upgrade first". Because the requirements sum
 * across nodes, buying a new node is often the best move even for the levels target: a fresh node
 * adds 1 level, 1 RAM and 1 core at once, which is three requirements at a single price. Only once
 * RAM and cores are satisfied does topping up levels on existing nodes become the cheaper path.
 */

const TARGET_LEVELS = 100;
const TARGET_RAM = 8;
const TARGET_CORES = 4;

interface Totals {
    nodes: number;
    levels: number;
    ram: number;
    cores: number;
}

function totals(ns: NS): Totals {
    const out: Totals = {nodes: ns.hacknet.numNodes(), levels: 0, ram: 0, cores: 0};
    for (let i = 0; i < out.nodes; i++) {
        const stats = ns.hacknet.getNodeStats(i);
        out.levels += stats.level;
        out.ram += stats.ram;
        out.cores += stats.cores;
    }
    return out;
}

function satisfied(t: Totals): boolean {
    return t.levels >= TARGET_LEVELS && t.ram >= TARGET_RAM && t.cores >= TARGET_CORES;
}

export async function main(ns: NS): Promise<void> {
    const maxFraction = Number(ns.args[0] ?? 0.25);
    const budget = ns.getServerMoneyAvailable("home") * maxFraction;
    let spent = 0;
    let bought = 0;

    for (let guard = 0; guard < 400; guard++) {
        const current = totals(ns);
        if (satisfied(current)) break;

        // Candidate purchases, each as [cost, apply]. Only offer ones that move an UNMET target,
        // so we never spend on levels while RAM is the thing still blocking the invite.
        const options: { cost: number; buy: () => boolean }[] = [];

        const nodeCost = ns.hacknet.getPurchaseNodeCost();
        if (Number.isFinite(nodeCost)) {
            options.push({cost: nodeCost, buy: () => ns.hacknet.purchaseNode() >= 0});
        }

        for (let i = 0; i < current.nodes; i++) {
            if (current.levels < TARGET_LEVELS) {
                const cost = ns.hacknet.getLevelUpgradeCost(i, 1);
                if (Number.isFinite(cost)) options.push({cost, buy: () => ns.hacknet.upgradeLevel(i, 1)});
            }
            if (current.ram < TARGET_RAM) {
                const cost = ns.hacknet.getRamUpgradeCost(i, 1);
                if (Number.isFinite(cost)) options.push({cost, buy: () => ns.hacknet.upgradeRam(i, 1)});
            }
            if (current.cores < TARGET_CORES) {
                const cost = ns.hacknet.getCoreUpgradeCost(i, 1);
                if (Number.isFinite(cost)) options.push({cost, buy: () => ns.hacknet.upgradeCore(i, 1)});
            }
        }

        options.sort((a, b) => a.cost - b.cost);
        const pick = options.find((o) => spent + o.cost <= budget && o.cost <= ns.getServerMoneyAvailable("home"));
        if (!pick) break;

        if (!pick.buy()) break;
        spent += pick.cost;
        bought++;
    }

    const final = totals(ns);
    // Raw object, not JSON - rpc/dodge returns whatever readPort gives back, and every other
    // helper in this directory writes the value itself (see helpers/getServer.ts).
    ns.atExit(() => ns.writePort(ns.pid, {
        ...final,
        spent,
        bought,
        satisfied: satisfied(final),
    }));
}
