import { NS } from "@ns";

const PORT_OPENERS: { file: string; run: (ns: NS, host: string) => boolean }[] = [
    { file: "BruteSSH.exe", run: (ns, host) => ns.brutessh(host) },
    { file: "FTPCrack.exe", run: (ns, host) => ns.ftpcrack(host) },
    { file: "relaySMTP.exe", run: (ns, host) => ns.relaysmtp(host) },
    { file: "HTTPWorm.exe", run: (ns, host) => ns.httpworm(host) },
    { file: "SQLInject.exe", run: (ns, host) => ns.sqlinject(host) }
];

export function ensureRootAccess(ns: NS, target: string): boolean {
    if (ns.hasRootAccess(target)) return true;

    const requiredLevel = ns.getServerRequiredHackingLevel(target);
    if (requiredLevel > ns.getPlayer().skills.hacking) {
        ns.tprint(`Cannot root ${target}: requires hacking level ${requiredLevel}.`);
        return false;
    }

    let portsOpened = 0;
    for (const opener of PORT_OPENERS) {
        if (ns.fileExists(opener.file, "home") && opener.run(ns, target)) {
            portsOpened++;
        }
    }

    const portsRequired = ns.getServerNumPortsRequired(target);
    if (portsOpened < portsRequired) {
        ns.tprint(`Cannot root ${target}: only ${portsOpened}/${portsRequired} ports could be opened.`);
        return false;
    }

    return ns.nuke(target);
}
