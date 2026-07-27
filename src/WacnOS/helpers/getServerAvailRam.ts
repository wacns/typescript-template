import {NS} from "@ns";

/** Home keeps a small headroom reserve so the loop never starves the terminal/other scripts of the last sliver of RAM. */
const HOME_RESERVE_GB = 32;

export async function main(ns: NS): Promise<void> {
    const hostname = ns.args[0] as string;
    const free = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
    const result = hostname === "home" ? Math.max(0, free - HOME_RESERVE_GB) : free;
    ns.atExit(() => ns.writePort(ns.pid, result));
}
