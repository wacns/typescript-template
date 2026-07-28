import {NS} from "@ns";

/**
 * Hacknet totals, summed the way the Netburners join conditions do
 * (Faction/FactionJoinCondition.ts:215-266): each requirement adds the stat across ALL nodes, so
 * eight fresh nodes already satisfy "total RAM 8" and "total cores 4" without a single upgrade.
 *
 * A dodge helper - ns.hacknet.* is cheap individually but adds up, and none of it belongs in the
 * daemon's static footprint.
 */
export interface HacknetTotals {
    nodes: number;
    levels: number;
    ram: number;
    cores: number;
}

export async function main(ns: NS): Promise<void> {
    const totals: HacknetTotals = {nodes: 0, levels: 0, ram: 0, cores: 0};

    const count = ns.hacknet.numNodes();
    totals.nodes = count;
    for (let i = 0; i < count; i++) {
        const stats = ns.hacknet.getNodeStats(i);
        totals.levels += stats.level;
        totals.ram += stats.ram;
        totals.cores += stats.cores;
    }

    // Raw object, not JSON - rpc/dodge returns whatever readPort gives back, and every other
    // helper in this directory writes the value itself (see helpers/getServer.ts).
    ns.atExit(() => ns.writePort(ns.pid, totals));
}
