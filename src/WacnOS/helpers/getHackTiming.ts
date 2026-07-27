import {NS} from "@ns";

export interface HackTiming {
    hackTime: number;
    growTime: number;
    weakenTime: number;
    hackChance: number;
    hackPercent: number;
}

/**
 * Formulas-accurate (accounts for exact player stats/multipliers) when Formulas.exe is owned,
 * otherwise falls back to the plain, less precise ns.* equivalents that are always available.
 * Isolates ns.formulas.hacking's RAM cost from the caller either way.
 */
export async function main(ns: NS): Promise<void> {
    const hostname = ns.args[0] as string;
    let result: HackTiming;

    if (ns.fileExists("Formulas.exe", "home")) {
        const server = ns.getServer(hostname);
        const player = ns.getPlayer();
        result = {
            hackTime: ns.formulas.hacking.hackTime(server, player),
            growTime: ns.formulas.hacking.growTime(server, player),
            weakenTime: ns.formulas.hacking.weakenTime(server, player),
            hackChance: ns.formulas.hacking.hackChance(server, player),
            hackPercent: ns.formulas.hacking.hackPercent(server, player),
        };
    } else {
        result = {
            hackTime: ns.getHackTime(hostname),
            growTime: ns.getGrowTime(hostname),
            weakenTime: ns.getWeakenTime(hostname),
            hackChance: ns.hackAnalyzeChance(hostname),
            hackPercent: ns.hackAnalyze(hostname),
        };
    }

    ns.atExit(() => ns.writePort(ns.pid, result));
}
