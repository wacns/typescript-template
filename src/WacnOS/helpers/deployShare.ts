import {NS} from "@ns";
import {scanAllServers} from "lib/network-scan";

/**
 * Fills spare network RAM with ns.share() threads, or clears them again.
 *
 * Args: ["on"|"off", homeReserveGB]
 *
 * Sharing competes with the hacking loop for RAM, so the autopilot only turns it on during the
 * Daedalus reputation grind - the one phase where reputation matters more than money - and turns
 * it off again afterwards.
 */

const SHARE_SCRIPT = "WacnOS/helpers/shareRam.js";

export async function main(ns: NS): Promise<void> {
    const mode = String(ns.args[0] ?? "on");
    const homeReserve = Number(ns.args[1] ?? 64);

    if (mode === "off") {
        let killed = 0;
        for (const host of scanAllServers(ns)) {
            for (const proc of ns.ps(host)) {
                if (proc.filename === SHARE_SCRIPT && ns.kill(proc.pid)) killed++;
            }
        }
        ns.atExit(() => ns.writePort(ns.pid, {mode, killed}));
        return;
    }

    const scriptRam = ns.getScriptRam(SHARE_SCRIPT);
    let threads = 0;
    let hosts = 0;

    for (const host of scanAllServers(ns)) {
        if (!ns.hasRootAccess(host)) continue;

        const maxRam = ns.getServerMaxRam(host);
        if (maxRam <= 0) continue;

        const reserve = host === "home" ? homeReserve : 0;
        const free = maxRam - ns.getServerUsedRam(host) - reserve;
        const count = Math.floor(free / scriptRam);
        if (count <= 0) continue;

        if (host !== "home" && !ns.fileExists(SHARE_SCRIPT, host)) ns.scp(SHARE_SCRIPT, host, "home");
        if (ns.exec(SHARE_SCRIPT, host, {threads: count, temporary: true}) > 0) {
            threads += count;
            hosts++;
        }
    }

    ns.atExit(() => ns.writePort(ns.pid, {mode, threads, hosts}));
}
