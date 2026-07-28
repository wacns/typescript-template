import {NS} from "@ns";
import {WacnOSConfig} from "WacnOS/config";
import {WacnPorts} from "WacnOS/ports";
import {dodge} from "WacnOS/rpc/dodge";
import {terminal} from "WacnOS/dom/terminal";
import {buyHomeRam, buyTor} from "WacnOS/dom/actions";
import {NETBURNERS_REQ} from "WacnOS/autopilot/phases";

/**
 * The income and infrastructure side of the autopilot: everything that should keep happening
 * regardless of which rung of the faction ladder we're on.
 *
 * Every function here is idempotent and cheap to call every tick. They read current state, do at
 * most one useful thing, and return - so the daemon never has to remember what it already did.
 */

const GET_HACKNET_TOTALS = "WacnOS/helpers/getHacknetTotals.js";
const GROW_HACKNET = "WacnOS/helpers/growHacknet.js";
const STOCK_BOOTSTRAP = "WacnOS/helpers/stockBootstrap.js";
const DEPLOY_SHARE = "WacnOS/helpers/deployShare.js";
const ROOT_NEW_SERVERS = "WacnOS/helpers/rootNewServers.js";
const PURCHASE_CLOUD = "Utils/purchase-cloud-servers.js";
const HACKLOOP = "WacnOS/launcher/hackloop.js";

/** Darkweb programs in ascending price - the order `buy -a` would spend money in anyway. */
const PROGRAMS: { name: string; cost: number }[] = [
    {name: "BruteSSH.exe", cost: 500e3},
    {name: "FTPCrack.exe", cost: 1.5e6},
    {name: "relaySMTP.exe", cost: 5e6},
    {name: "HTTPWorm.exe", cost: 30e6},
    {name: "SQLInject.exe", cost: 250e6},
];

/** Formulas.exe is expensive but unlocks exact HWGW batch maths for the hacking loop. */
const FORMULAS = {name: "Formulas.exe", cost: 5e9};

export interface InfraState {
    rooted: number;
    programs: number;
    tor: boolean;
}

/**
 * Keeps the basics running: root new servers, keep the hacking loop alive, buy port openers,
 * upgrade home RAM.
 *
 * Home RAM is bought whenever it costs under a tenth of current money. Being aggressive early
 * matters because home starts at 8GB in BN1 and every WacnOS process competes for it - but the
 * fraction rule means it naturally stops mattering once augmentations are the better use.
 */
export async function ensureInfra(ns: NS, config: WacnOSConfig, version: string): Promise<InfraState> {
    const rooted = await dodge(ns, ROOT_NEW_SERVERS) as number;

    if (ns.peek(WacnPorts.HACKLOOP_PID) === "NULL PORT DATA") {
        const ram = ns.getScriptRam(HACKLOOP);
        if (ns.getServerMaxRam("home") - ns.getServerUsedRam("home") >= ram) {
            ns.exec(HACKLOOP, "home", 1, ...(config.hackLoopPurchaseServers ? ["purchase"] : []));
        }
    }

    const tor = ns.hasTorRouter();
    if (!tor && ns.getPlayer().money > 1e6) {
        // Best-effort: needs a tech vendor in the current city, which isn't always true.
        await buyTor(ns, version).catch(() => undefined);
    }

    const programs = await ensurePrograms(ns, version);

    if (config.hackLoopPurchaseServers) {
        ns.exec(PURCHASE_CLOUD, "home", 1, -1);
    }

    return {rooted, programs, tor: ns.hasTorRouter()};
}

/**
 * Buys darkweb programs through the terminal's `buy` command - the one part of the darkweb that
 * needs no Singularity, provided TOR is already owned.
 *
 * Returns how many of the five port openers we now have.
 */
export async function ensurePrograms(ns: NS, version: string): Promise<number> {
    if (!ns.hasTorRouter()) return countPrograms(ns);

    const money = ns.getPlayer().money;

    for (const program of PROGRAMS) {
        if (ns.fileExists(program.name, "home")) continue;
        if (money < program.cost) break; // ascending price - nothing later is affordable either
        await terminal(`buy ${program.name}`, version);
        return countPrograms(ns); // one purchase per tick keeps the terminal free
    }

    if (!ns.fileExists(FORMULAS.name, "home") && money >= FORMULAS.cost * 2) {
        await terminal(`buy ${FORMULAS.name}`, version);
    }

    return countPrograms(ns);
}

function countPrograms(ns: NS): number {
    return PROGRAMS.filter((p) => ns.fileExists(p.name, "home")).length;
}

/** Buys home RAM when it's cheap relative to current money. */
export async function maybeUpgradeHomeRam(ns: NS, version: string): Promise<boolean> {
    const maxRam = ns.getServerMaxRam("home");
    if (maxRam >= 1024) return false;

    const money = ns.getPlayer().money;
    // No non-Singularity way to price this, so use money as the gate and let the action itself
    // fail harmlessly if it turns out to be unaffordable.
    if (money < 1e6) return false;

    const result = await buyHomeRam(ns, version).catch(() => ({ok: false}));
    return result.ok;
}

export interface HacknetState {
    nodes: number;
    levels: number;
    ram: number;
    cores: number;
    satisfied: boolean;
}

/** Grows the hacknet toward the Netburners thresholds, then stops spending on it. */
export async function ensureHacknet(ns: NS, config: WacnOSConfig): Promise<HacknetState> {
    const totals = await dodge(ns, GET_HACKNET_TOTALS) as HacknetState;
    const met = totals.levels >= NETBURNERS_REQ.levels
        && totals.ram >= NETBURNERS_REQ.ram
        && totals.cores >= NETBURNERS_REQ.cores;

    if (!config.useHacknet || met) return {...totals, satisfied: met};

    const grown = await dodge(ns, GROW_HACKNET, [0.25]) as HacknetState;
    return {...grown, satisfied: grown.satisfied ?? false};
}

/** Buys the stock market unlocks as they become affordable. No Source-File required for any of them. */
export async function ensureStocks(ns: NS, config: WacnOSConfig, reserve: number): Promise<void> {
    if (!config.useStocks) return;
    await dodge(ns, STOCK_BOOTSTRAP, [reserve]);
}

/**
 * Turns ns.share() on or off across the network.
 *
 * Only worth running during the Daedalus grind: it trades hacking income for a reputation
 * multiplier, and outside that phase we want the income.
 */
export async function setSharing(ns: NS, on: boolean, homeReserve = 64): Promise<void> {
    await dodge(ns, DEPLOY_SHARE, [on ? "on" : "off", homeReserve]);
    if (on) ns.writePort(WacnPorts.SHARE_PID, ns.pid);
    else ns.clearPort(WacnPorts.SHARE_PID);
}
