import {NS} from "@ns";

const PORT_OPENERS: { file: string; run: (ns: NS, host: string) => boolean }[] = [
    {file: "BruteSSH.exe", run: (ns, host) => ns.brutessh(host)},
    {file: "FTPCrack.exe", run: (ns, host) => ns.ftpcrack(host)},
    {file: "relaySMTP.exe", run: (ns, host) => ns.relaysmtp(host)},
    {file: "HTTPWorm.exe", run: (ns, host) => ns.httpworm(host)},
    {file: "SQLInject.exe", run: (ns, host) => ns.sqlinject(host)}
];

/** Runs every port opener the player currently owns against target. Returns how many ports were opened. */
export function openAvailablePorts(ns: NS, target: string): number {
    let portsOpened = 0;
    for (const opener of PORT_OPENERS) {
        if (ns.fileExists(opener.file, "home") && opener.run(ns, target)) {
            portsOpened++;
        }
    }
    return portsOpened;
}

/**
 * Roots a server if possible.
 *
 * `verbose` defaults to false deliberately. This is called every tick, for every server on the
 * network, by rootNewServers.js and the autopilot - and early on, most servers are unrootable
 * because the port crackers haven't been bought yet. Announcing each expected failure to the
 * terminal buried real output under hundreds of identical lines. Failing quietly is correct here:
 * "not yet rootable" is the normal state, not an error, and the caller reports the count.
 */
export function ensureRootAccess(ns: NS, target: string, verbose = false): boolean {
    if (ns.hasRootAccess(target)) return true;

    const requiredLevel = ns.getServerRequiredHackingLevel(target);
    if (requiredLevel > ns.getPlayer().skills.hacking) {
        if (verbose) ns.tprint(`Cannot root ${target}: requires hacking level ${requiredLevel}.`);
        return false;
    }

    const portsOpened = openAvailablePorts(ns, target);
    const portsRequired = ns.getServerNumPortsRequired(target);
    if (portsOpened < portsRequired) {
        if (verbose) ns.tprint(`Cannot root ${target}: only ${portsOpened}/${portsRequired} ports could be opened.`);
        return false;
    }

    return ns.nuke(target);
}
