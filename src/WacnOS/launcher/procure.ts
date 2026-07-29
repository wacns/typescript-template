import {NS} from "@ns";
import {buyTor, techVendorFor, travelTo} from "WacnOS/dom/actions";
import {terminal} from "WacnOS/dom/terminal";
import {sleep} from "WacnOS/dom/doc";

/**
 * Buys the TOR router and every port-opening program, then exits.
 *
 * This exists as its own tiny script rather than living in the autopilot because of WHEN it is
 * needed. The daemon refuses to start below MIN_HOME_RAM (32GB), which on a fresh node is a long
 * way off - so anything gated behind the daemon does not happen in early game at all. TOR is the
 * gate on the terminal `buy` command, which is the gate on the five port crackers, which are the
 * gate on rooting servers and therefore on the whole hacking economy. It has to come first.
 *
 * Nothing here needs Source-File 4:
 *   - TOR itself is a button on a tech vendor's page (Locations/ui/TorButton.tsx), driven via DOM.
 *   - Every program after that is `buy <name>` in the terminal, injected from dom/terminal.ts.
 *
 * Args: [reserveMoney] - never spend below this.
 * Flags: --no-travel  stay put even if the current city has no tech vendor.
 *        --formulas   also buy Formulas.exe ($5b) once the crackers are done.
 */

/** Darkweb prices, ascending - DarkWeb/DarkWebItems.ts. */
const PROGRAMS: { name: string; cost: number }[] = [
    {name: "BruteSSH.exe", cost: 500e3},
    {name: "FTPCrack.exe", cost: 1.5e6},
    {name: "relaySMTP.exe", cost: 5e6},
    {name: "HTTPWorm.exe", cost: 30e6},
    {name: "SQLInject.exe", cost: 250e6},
];

const FORMULAS = {name: "Formulas.exe", cost: 5e9};
const TOR_COST = 200e3;      // CONSTANTS.TorRouterCost
const TRAVEL_COST = 200e3;   // CONSTANTS.TravelCost
/** Sector-12's vendor is Alpha Enterprises, and Sector-12 is itself a ladder faction. */
const FALLBACK_CITY = "Sector-12";

const POLL_MS = 10000;

export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    const flags = ns.flags([["no-travel", false], ["formulas", false]]);
    const reserve = Number(ns.args.find((a) => typeof a === "number") ?? 0);
    const version = String(ns.ui.getGameInfo().version);

    ns.print("WacnOS procurement: TOR + port openers");

    for (; ;) {
        const money = ns.getPlayer().money - reserve;
        const missing = PROGRAMS.filter((p) => !ns.fileExists(p.name, "home"));
        const wantFormulas = Boolean(flags.formulas) && !ns.fileExists(FORMULAS.name, "home");

        if (ns.hasTorRouter() && missing.length === 0 && !wantFormulas) {
            ns.print("SUCCESS all programs owned - procurement complete");
            ns.toast("WacnOS: TOR and all port openers acquired.", "success");
            return;
        }

        if (!ns.hasTorRouter()) {
            await acquireTor(ns, money, Boolean(flags["no-travel"]), version);
        } else if (missing.length > 0) {
            // Ascending price: if the cheapest missing one is unaffordable, so is everything after.
            const next = missing[0];
            if (money >= next.cost) {
                ns.print(`buying ${next.name} ($${ns.format.number(next.cost)})`);
                await terminal(`buy ${next.name}`, version);
                await sleep(600);
            }
        } else if (wantFormulas && money >= FORMULAS.cost) {
            ns.print(`buying ${FORMULAS.name}`);
            await terminal(`buy ${FORMULAS.name}`, version);
            await sleep(600);
        }

        await ns.asleep(POLL_MS);
    }
}

/**
 * Buys TOR, travelling first if the current city has no tech vendor.
 *
 * Chongqing and New Tokyo have no vendor at all, so a player who starts or wanders there would
 * otherwise wait forever - the original ensureInfra just returned a failure and tried again next
 * tick, which is a silent stall rather than a fix.
 */
async function acquireTor(ns: NS, money: number, noTravel: boolean, version: string): Promise<void> {
    const city = ns.getPlayer().city;
    const vendor = techVendorFor(city);

    if (!vendor) {
        if (noTravel) {
            ns.print(`WARN  ${city} has no tech vendor and --no-travel is set`);
            return;
        }
        if (money < TOR_COST + TRAVEL_COST) return; // can't afford the trip AND the router
        ns.print(`${city} has no tech vendor - travelling to ${FALLBACK_CITY}`);
        await travelTo(ns, FALLBACK_CITY, version).catch(() => undefined);
        return; // re-evaluate next tick, now hopefully somewhere with a vendor
    }

    if (money < TOR_COST) return;

    ns.print(`buying the TOR router at ${vendor}`);
    const result = await buyTor(ns, version).catch((err) => ({ok: false, reason: String(err)}));
    if (!result.ok) ns.print(`WARN  TOR purchase failed: ${result.reason ?? "unknown"}`);
    else ns.toast("WacnOS: TOR router purchased.", "success");
}

/** Exported for the loader's status line: how much of the procurement is done. */
export function procurementState(ns: NS): { tor: boolean; owned: number; total: number } {
    return {
        tor: ns.hasTorRouter(),
        owned: PROGRAMS.filter((p) => ns.fileExists(p.name, "home")).length,
        total: PROGRAMS.length,
    };
}
