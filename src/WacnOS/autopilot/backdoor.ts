import {NS, Server} from "@ns";
import {terminalSeq} from "WacnOS/dom/terminal";
import {sleep} from "WacnOS/dom/doc";
import {ensureRootAccess} from "lib/root-access";
import {dodge} from "WacnOS/rpc/dodge";

const GET_SERVER = "WacnOS/helpers/getServer.js";

/**
 * Server backdooring without Source-File 4.
 *
 * `backdoor` is a real terminal command (Terminal/commands/backdoor.ts), so injecting it gets us
 * the four faction invites that gate the whole BN1 ladder - CyberSec, NiteSec, The Black Hand and
 * BitRunners each require a backdoor on their server and nothing else.
 *
 * Backdooring also force-triggers the game's faction invitation check (backdoor.ts:64-66) rather
 * than waiting for the ~2s engine tick, so the invite lands immediately.
 */

/** The servers that unlock the hacking factions, in the order their hacking requirements rise. */
export const FACTION_SERVERS: Record<string, string> = {
    CyberSec: "CSEC",
    NiteSec: "avmnite-02h",
    "The Black Hand": "I.I.I.I",
    BitRunners: "run4theh111z",
};

/**
 * Breadth-first path from home to `target`, inclusive of the target and excluding home.
 *
 * SphyxOS walks `ns.scan(host)[0]` backwards on the assumption that a server's first neighbour is
 * always its parent toward home (crawl-Basic.js). That holds for the vanilla network but is an
 * assumption about ordering rather than a guarantee, and it silently produces a broken connect
 * chain if it's ever wrong. A real BFS costs one extra scan per server and cannot be wrong.
 */
export function pathTo(ns: NS, target: string): string[] | null {
    const parents = new Map<string, string>([["home", ""]]);
    const queue = ["home"];

    while (queue.length > 0) {
        const host = queue.shift() as string;
        if (host === target) break;
        for (const neighbor of ns.scan(host)) {
            if (parents.has(neighbor)) continue;
            parents.set(neighbor, host);
            queue.push(neighbor);
        }
    }

    if (!parents.has(target)) return null;

    const path: string[] = [];
    for (let host = target; host && host !== "home"; host = parents.get(host) as string) {
        path.unshift(host);
    }
    return path;
}

export interface BackdoorResult {
    ok: boolean;
    reason?: string;
}

/**
 * Whether a server already has a backdoor. Routed through the dodge helper because ns.getServer
 * costs 2GB, which would otherwise be charged to the daemon that imports this module.
 */
export async function isBackdoored(ns: NS, host: string): Promise<boolean> {
    try {
        const server = await dodge(ns, GET_SERVER, [host]) as Server;
        return !!server?.backdoorInstalled;
    } catch {
        return false;
    }
}

/**
 * Roots and backdoors one server, blocking for the duration of the in-game action.
 *
 * The wait is hackTime/4 (backdoor.ts:55) plus a margin - there is no completion event to observe
 * from a script, and cutting it short would leave the terminal mid-action so the next injected
 * command is swallowed.
 */
export async function backdoorHost(ns: NS, host: string, version: string): Promise<BackdoorResult> {
    if (!ns.serverExists(host)) return {ok: false, reason: `${host} does not exist`};
    if (await isBackdoored(ns, host)) return {ok: true};
    if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) {
        return {ok: false, reason: `hacking ${ns.getServerRequiredHackingLevel(host)} required for ${host}`};
    }
    if (!ns.hasRootAccess(host) && !ensureRootAccess(ns, host)) {
        return {ok: false, reason: `could not root ${host}`};
    }

    const path = pathTo(ns, host);
    if (!path) return {ok: false, reason: `no route to ${host}`};

    // One submission: each hop must be issued from the previous server, so splitting these across
    // separate injections would race the UI.
    await terminalSeq(["home", ...path.map((hop) => `connect ${hop}`), "backdoor"], version);

    await sleep(ns.getHackTime(host) / 4 + 3000);
    await terminalSeq(["home"], version);

    return {ok: true};
}

/**
 * Backdoors whichever faction server we can currently reach, cheapest first, skipping any already
 * done. Returns the servers it completed this pass.
 */
export async function backdoorFactionServers(ns: NS, version: string, only?: string[]): Promise<string[]> {
    const done: string[] = [];
    const wanted = only ?? Object.values(FACTION_SERVERS);

    for (const host of wanted) {
        if (!ns.serverExists(host)) continue;
        if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) continue;
        if (await isBackdoored(ns, host)) continue;

        const result = await backdoorHost(ns, host, version);
        if (result.ok) done.push(host);
    }

    return done;
}
