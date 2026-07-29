import {NS} from "@ns";
import {loadConfig, saveConfig} from "WacnOS/config";
import {WacnPorts} from "WacnOS/ports";
import {AutopilotStatus, publishAutopilotStatus, readAutopilotStatus} from "WacnOS/status";
import {getBridge} from "WacnOS/bridge/webpack";
import {bridgeOk, snapshot} from "WacnOS/bridge/gamestate";
import {buttonContaining, byAriaPrefix, doc, find} from "WacnOS/dom/doc";
import {SelectorError} from "WacnOS/dom/guard";
import {goTo} from "WacnOS/dom/nav";
import {terminal} from "WacnOS/dom/terminal";
import {clickBitVersePortal, techVendorFor} from "WacnOS/dom/actions";
import {casinoWinnings} from "WacnOS/dom/casino";
import {FACTION_SERVERS, isBackdoored, pathTo} from "WacnOS/autopilot/backdoor";
import {BN1_LADDER, CITY_FACTIONS, DAEDALUS, INVITE_ALLOWLIST, MIN_HOME_RAM, worldDaemonHacking} from "WacnOS/autopilot/phases";
import {planPurchases, repGoalFor} from "WacnOS/autopilot/plan";
import {decide} from "WacnOS/autopilot/decide";
import {nextBitNode, ROUTE_IDS} from "WacnOS/autopilot/route";
import {armRelaunch, clearMarker, disarmRelaunch, isRelaunchArmed, readMarker, writeMarker} from "WacnOS/autopilot/resume";
import {dodge} from "WacnOS/rpc/dodge";

/**
 * The master self-test: exercises every milestone's machinery and prints one pass/fail table.
 *
 * Default mode is READ-ONLY and safe to run at any time - it never joins a faction, buys anything,
 * travels, installs, or takes a portal. That restraint is the point: the irreversible actions are
 * exactly the ones you cannot verify by trying them, so this checks everything reachable around
 * them instead, and dry-runs the two that support it.
 *
 *   run WacnOS/autopilot/selftest.js            read-only checks
 *   run WacnOS/autopilot/selftest.js --active   also drives the UI harmlessly (navigation, a
 *                                               terminal command, the relaunch timer, and a
 *                                               BitVerse portal dry run). Takes ~15s.
 *   run WacnOS/autopilot/selftest.js --verbose  include per-check detail even when passing
 */

type Status = "PASS" | "FAIL" | "WARN" | "SKIP";

interface Result {
    status: Status;
    detail: string;
}

interface Check {
    milestone: string;
    name: string;
    /** Needs --active: touches the UI, though never irreversibly. */
    active?: boolean;
    verify: () => Result | Promise<Result>;
}

const pass = (detail = ""): Result => ({status: "PASS", detail});
const fail = (detail: string): Result => ({status: "FAIL", detail});
const warn = (detail: string): Result => ({status: "WARN", detail});
const skip = (detail: string): Result => ({status: "SKIP", detail});

export async function main(ns: NS): Promise<void> {
    const flags = ns.flags([["active", false], ["verbose", false]]);
    const active = Boolean(flags.active);
    const verbose = Boolean(flags.verbose);
    const version = String(ns.ui.getGameInfo().version);

    ns.tprint("");
    ns.tprint("=================================================================");
    ns.tprint(" WacnOS autopilot self-test");
    ns.tprint(`   game ${version}   BitNode ${ns.getResetInfo().currentNode}   ${active ? "ACTIVE mode" : "read-only mode"}`);
    ns.tprint("=================================================================");

    const checks = buildChecks(ns, version, active);
    const tally: Record<Status, number> = {PASS: 0, FAIL: 0, WARN: 0, SKIP: 0};
    let lastMilestone = "";

    for (const check of checks) {
        if (check.milestone !== lastMilestone) {
            ns.tprint("");
            ns.tprint(`--- ${check.milestone} ---`);
            lastMilestone = check.milestone;
        }

        let result: Result;
        try {
            result = await check.verify();
        } catch (err) {
            result = err instanceof SelectorError
                ? fail(`selector missing: ${err.selector}`)
                : fail(String(err));
        }

        tally[result.status]++;
        const show = verbose || result.status !== "PASS";
        ns.tprint(`  [${result.status}] ${check.name}${show && result.detail ? ` - ${result.detail}` : ""}`);
    }

    ns.tprint("");
    ns.tprint("=================================================================");
    ns.tprint(` ${tally.PASS} passed, ${tally.FAIL} failed, ${tally.WARN} warnings, ${tally.SKIP} skipped`);
    if (!active) ns.tprint(" run with --active to also exercise navigation and the relaunch timer");
    if (tally.FAIL > 0) ns.tprint(" FAILURES ABOVE - do not run the autopilot unattended until resolved");
    ns.tprint("=================================================================");
}

function buildChecks(ns: NS, version: string, active: boolean): Check[] {
    return [
        // ---------- M0: config, ports, status ----------
        {
            milestone: "M0  config / ports / status",
            name: "config round-trips through disk",
            verify: () => {
                const before = loadConfig(ns);
                saveConfig(ns, before);
                const after = loadConfig(ns);
                return after.route === before.route && after.augsAtOnce === before.augsAtOnce
                    ? pass(`route ${after.route}, augs/install ${after.augsAtOnce}`)
                    : fail("config did not survive a save/load cycle");
            },
        },
        {
            milestone: "M0  config / ports / status",
            name: "port numbers are unique",
            verify: () => {
                const values = Object.values(WacnPorts);
                return new Set(values).size === values.length
                    ? pass(`${values.length} ports, ${Math.min(...values)}-${Math.max(...values)}`)
                    : fail("duplicate port numbers in WacnPorts");
            },
        },
        {
            milestone: "M0  config / ports / status",
            name: "autopilot status publishes and reads back",
            verify: () => {
                const existing = readAutopilotStatus(ns);
                const sample: AutopilotStatus = {
                    phase: "BOOT", label: "selftest", step: "0/0", bitNode: 0, nextBitNode: 0,
                    route: "selftest", moveOn: false, ownedAugs: 0, queuedAugs: 0, augGoal: 0,
                    daedalusRep: 0, daedalusRepGoal: 0, daedalusEtaMs: -1, money: 0, hacking: 0,
                    paused: false, pausedReason: "", lastSelectorMiss: "", bridgeOk: false,
                    updatedAt: Date.now(),
                };
                publishAutopilotStatus(ns, sample);
                const readBack = readAutopilotStatus(ns);

                // Restore only if a daemon is actually running to own that status; otherwise clear.
                //
                // Restoring whatever happened to be on the port is not good enough: the status
                // port outlives the process that wrote it, so once a synthetic sample was left
                // behind it got faithfully restored on every subsequent run and the loader kept
                // rendering a phantom "BOOT / bridge DEGRADED" autopilot that was never running.
                // A live daemon republishes within a tick anyway, so nothing is lost either way.
                const daemonRunning = ns.peek(WacnPorts.AUTOPILOT_PID) !== "NULL PORT DATA";
                if (daemonRunning && existing) publishAutopilotStatus(ns, existing);
                else ns.clearPort(WacnPorts.AUTOPILOT_STATUS);

                return readBack?.label === "selftest" ? pass() : fail("status did not round-trip");
            },
        },
        {
            milestone: "M0  config / ports / status",
            name: "home has enough RAM to actually run the autopilot",
            verify: () => {
                const homeRam = ns.getServerMaxRam("home");
                const daemon = ns.getScriptRam("WacnOS/autopilot/daemon.js");
                const hackloop = ns.getScriptRam("WacnOS/launcher/hackloop.js");
                const detail = `home ${homeRam}GB; daemon ${daemon}GB + hackloop ${hackloop}GB + dodge headroom`;

                if (homeRam >= MIN_HOME_RAM) return pass(detail);
                // Not a failure - it's the expected state on a fresh node, and the guard in
                // WLoader/daemon refuses to start rather than deadlocking. But it IS the reason
                // the autopilot won't come up, so say so plainly.
                return warn(`${detail} - run hackloop.js alone until home reaches ${MIN_HOME_RAM}GB`);
            },
        },
        {
            milestone: "M0  config / ports / status",
            name: "route table resolves a next BitNode",
            verify: () => {
                const config = loadConfig(ns);
                const target = nextBitNode(ns, config);
                return target >= 1 && target <= 15
                    ? pass(`route "${config.route}" -> BitNode ${target} (of ${ROUTE_IDS.length} routes)`)
                    : fail(`nextBitNode returned ${target}`);
            },
        },

        // ---------- M1: DOM layer ----------
        {
            milestone: "M1  DOM layer",
            name: "document reachable without the 25GB token",
            verify: () => (doc() ? pass() : fail("globalThis[\"document\"] was undefined")),
        },
        {
            milestone: "M1  DOM layer",
            name: "sidebar entries resolve (MuiDrawer, Typography renders as <p>)",
            verify: () => {
                const inSidebar = (p: string) =>
                    !!find(`//div[contains(@class,'MuiDrawer-root')]//*[normalize-space(text())='${p}']`);

                // Terminal, Stats, City and Hacknet are always present. Factions and Augmentations
                // are gated on progress (SidebarRoot.tsx:157) and simply do not exist on a fresh
                // BitNode - for those, goTo falls through to routing directly, so their absence is
                // expected rather than a failure.
                const always = ["Terminal", "Stats", "City", "Hacknet"];
                const gated = ["Factions", "Augmentations"];
                const missing = always.filter((p) => !inSidebar(p));
                const gatedMissing = gated.filter((p) => !inSidebar(p));

                if (missing.length > 0) {
                    return fail(`missing always-present ${missing.join(", ")} - sidebar markup may have changed`);
                }
                return gatedMissing.length === 0
                    ? pass("all six present")
                    : pass(`${always.length} core present; ${gatedMissing.join(", ")} not yet unlocked (routed directly)`);
            },
        },
        {
            milestone: "M1  DOM layer",
            name: "progress-gated pages are reachable by routing",
            verify: () => {
                const router = getBridge(version)?.Router;
                if (router) return pass("Router available for Factions/Augmentations before they appear in the sidebar");
                const gatedVisible = ["Factions", "Augmentations"].every((p) =>
                    find(`//div[contains(@class,'MuiDrawer-root')]//*[normalize-space(text())='${p}']`));
                return gatedVisible
                    ? pass("sidebar entries present, so routing is not needed yet")
                    : fail("no Router AND the gated sidebar entries are absent - those pages are unreachable");
            },
        },
        {
            milestone: "M1  DOM layer",
            name: "SelectorError carries the failing selector",
            verify: () => {
                const err = new SelectorError("#nonexistent", "selftest");
                return err.selector === "#nonexistent" && err.message.includes("#nonexistent")
                    ? pass()
                    : fail("SelectorError lost its selector");
            },
        },
        {
            milestone: "M1  DOM layer",
            name: "navigate to every page the autopilot uses",
            active: true,
            verify: async () => {
                const pages = ["Stats", "Factions", "City", "Hacknet", "Terminal"] as const;
                const failed: string[] = [];
                for (const page of pages) {
                    try {
                        await goTo(page, version);
                    } catch {
                        failed.push(page);
                    }
                }
                return failed.length === 0 ? pass(`${pages.length} pages`) : fail(`could not reach ${failed.join(", ")}`);
            },
        },
        {
            milestone: "M1  DOM layer",
            name: "terminal injection executes a command",
            active: true,
            verify: async () => {
                await terminal("expr 31337", version);
                return doc().getElementById("terminal-input")
                    ? pass("submitted 'expr 31337' - check the terminal")
                    : fail("#terminal-input vanished after submitting");
            },
        },

        // ---------- M2: the read-bridge ----------
        {
            milestone: "M2  webpack read-bridge",
            name: "bridge builds",
            verify: () => (bridgeOk(ns) ? pass() : fail("fingerprints matched nothing - autopilot would run DEGRADED")),
        },
        {
            milestone: "M2  webpack read-bridge",
            name: "all fingerprints resolved",
            verify: () => {
                const bridge = getBridge(version);
                if (!bridge) return fail("no bridge");
                const missing: string[] = [];
                if (!bridge.Player) missing.push("Player");
                if (!bridge.Factions) missing.push("Factions");
                if (!bridge.Augmentations) missing.push("Augmentations");
                if (!bridge.nodeMults) missing.push("nodeMults");
                if (!bridge.BadRNG) missing.push("BadRNG");
                if (!bridge.Router) missing.push("Router");
                if (missing.length === 0) {
                    return pass(`${Object.keys(bridge.Factions).length} factions, ${Object.keys(bridge.Augmentations).length} augs`);
                }
                // nodeMults/BadRNG/Router degrade gracefully; the registries do not.
                const critical = missing.filter((m) => ["Player", "Factions", "Augmentations"].includes(m));
                return critical.length > 0 ? fail(`missing ${missing.join(", ")}`) : warn(`missing ${missing.join(", ")} (degrades)`);
            },
        },
        {
            milestone: "M2  webpack read-bridge",
            name: "bridge agrees with ns on money and augmentations",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return fail("no snapshot");
                const nsMoney = ns.getPlayer().money;
                const nsAugs = ns.getResetInfo().ownedAugs.size;
                const moneyOk = Math.abs(snap.money - nsMoney) < Math.max(1, nsMoney * 0.001);
                const augsOk = snap.distinctOwned === nsAugs;
                if (moneyOk && augsOk) return pass(`$${ns.format.number(snap.money)}, ${snap.distinctOwned} augs`);
                return fail(`money ${snap.money} vs ${nsMoney}, augs ${snap.distinctOwned} vs ${nsAugs}`);
            },
        },
        {
            milestone: "M2  webpack read-bridge",
            name: "bridge is pinned to the current BitNode",
            verify: () => {
                const bridge = getBridge(version);
                const node = ns.getResetInfo().currentNode;
                return bridge?.node === node
                    ? pass(`built for BitNode ${node}`)
                    : fail(`bridge says node ${bridge?.node}, game says ${node} - node multipliers would be stale`);
            },
        },

        // ---------- M3: reversible actions ----------
        {
            milestone: "M3  reversible actions",
            name: "tech vendor known for the current city",
            verify: () => {
                const city = ns.getPlayer().city;
                const vendor = techVendorFor(city);
                if (vendor) return pass(`${city} -> ${vendor}`);
                return ["Chongqing", "New Tokyo"].includes(city)
                    ? warn(`${city} has no tech vendor (expected)`)
                    : fail(`no tech vendor mapped for ${city}`);
            },
        },
        {
            milestone: "M3  reversible actions",
            name: "travel is reachable by fiber (ASCII map has no selectors)",
            verify: () => {
                // Only meaningful while the Travel page is open; otherwise just confirm the
                // fallback button text would be constructed correctly.
                const listMode = buttonContaining("Travel to ");
                return listMode
                    ? pass("list-mode travel buttons present")
                    : skip("not on the Travel page - fiber path is used when the ASCII map is active");
            },
        },

        // ---------- M4: backdoor crawler ----------
        {
            milestone: "M4  backdoor crawler",
            name: "routes exist to every faction server",
            verify: () => {
                const missing: string[] = [];
                const details: string[] = [];
                for (const [faction, host] of Object.entries(FACTION_SERVERS)) {
                    if (!ns.serverExists(host)) {
                        missing.push(`${host} absent`);
                        continue;
                    }
                    const path = pathTo(ns, host);
                    if (!path) missing.push(`no route to ${host}`);
                    else details.push(`${faction}:${path.length} hops`);
                }
                return missing.length === 0 ? pass(details.join(", ")) : fail(missing.join("; "));
            },
        },
        {
            milestone: "M4  backdoor crawler",
            name: "backdoor state readable via the dodge helper",
            verify: async () => {
                const host = FACTION_SERVERS.CyberSec;
                if (!ns.serverExists(host)) return skip(`${host} not on the network`);
                const done = await isBackdoored(ns, host);
                return pass(`${host} backdoored: ${done}`);
            },
        },

        // ---------- M5: factions ----------
        {
            milestone: "M5  faction ladder",
            name: "allowlist excludes every enemy city faction",
            verify: () => {
                const banned = ["Chongqing", "New Tokyo", "Ishima", "Volhaven"];
                const leaked = banned.filter((f) => INVITE_ALLOWLIST.has(f));
                return leaked.length === 0
                    ? pass(`${INVITE_ALLOWLIST.size} joinable, ${banned.length} correctly excluded`)
                    : fail(`ALLOWLIST LEAK: ${leaked.join(", ")} - joining these bans Sector-12 and Aevum`);
            },
        },
        {
            milestone: "M5  faction ladder",
            name: "ladder factions all known to the bridge",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return skip("no bridge");
                const unknown = BN1_LADDER.filter((f) => !snap.factions[f]);
                return unknown.length === 0
                    ? pass(`${BN1_LADDER.length} rungs, ${BN1_LADDER.filter((f) => snap.factions[f].joined).length} joined`)
                    : fail(`bridge does not know: ${unknown.join(", ")}`);
            },
        },
        {
            milestone: "M5  faction ladder",
            name: "no un-joinable invite is pending unnoticed",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return skip("no bridge");
                const ignored = snap.invitations.filter((f) => !INVITE_ALLOWLIST.has(f));
                return ignored.length === 0
                    ? pass("no invites being ignored")
                    : warn(`ignoring (correctly): ${ignored.join(", ")}`);
            },
        },

        // ---------- M6: purchasing ----------
        {
            milestone: "M6  purchase planner",
            name: "augmentation prices look sane",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return skip("no bridge");
                const nfg = snap.augs["NeuroFlux Governor"];
                if (!nfg) return fail("NeuroFlux Governor missing from the catalogue");
                if (!(nfg.moneyCost > 0) || !Number.isFinite(nfg.moneyCost)) {
                    return fail(`NeuroFlux price is ${nfg.moneyCost}`);
                }
                return pass(`NFG $${ns.format.number(nfg.moneyCost)} / ${ns.format.number(nfg.repCost)} rep, step x${snap.priceMultiplier.toFixed(3)}`);
            },
        },
        {
            milestone: "M6  purchase planner",
            name: "planner orders most-expensive-first",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return skip("no bridge");
                const joined = Object.values(snap.factions).filter((f) => f.joined).map((f) => f.name);
                const plan = planPurchases(snap, joined, {allowNFG: false, reserve: 0});
                if (plan.length === 0) return skip("nothing affordable to plan right now");
                // Costs already include the escalation, so compare base-equivalents.
                const bases = plan.map((b, i) => b.moneyCost / Math.pow(snap.priceMultiplier, i));
                const descending = bases.every((c, i) => i === 0 || bases[i - 1] >= c - 1);
                return descending
                    ? pass(`${plan.length} augs, first ${plan[0].aug}`)
                    : fail("plan is not in descending base-cost order - this overpays");
            },
        },
        {
            milestone: "M6  purchase planner",
            name: "reputation goals computed for joined factions",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return skip("no bridge");
                const joined = Object.values(snap.factions).filter((f) => f.joined);
                if (joined.length === 0) return skip("no factions joined yet");
                const goals = joined.map((f) => `${f.name}:${ns.format.number(repGoalFor(snap, f.name))}`);
                return pass(goals.join(", "));
            },
        },

        // ---------- M6a: surviving a prestige ----------
        {
            milestone: "M6a resume across prestige",
            name: "marker file round-trips",
            verify: () => {
                const existing = readMarker(ns);
                writeMarker(ns, {
                    stage: "install", bitNode: ns.getResetInfo().currentNode,
                    handoff: "wacnos", route: "bn1-to-bn4", writtenAt: Date.now(),
                });
                const readBack = readMarker(ns);
                clearMarker(ns);
                const cleared = readMarker(ns) === null;
                if (existing) writeMarker(ns, existing); // restore a real pending marker
                return readBack?.stage === "install" && cleared
                    ? pass()
                    : fail(`write ${!!readBack}, clear ${cleared}`);
            },
        },
        {
            milestone: "M6a resume across prestige",
            name: "relaunch timer arms and disarms",
            verify: () => {
                // Arming has two phases - an initial delay, then a retry interval. Checking only
                // the interval handle right after arming would always read "not armed", and a
                // disarm that missed the delay would let it fire later with nothing able to stop it.
                const wasArmed = isRelaunchArmed();
                armRelaunch(600000, "expr 0");
                const armed = isRelaunchArmed();
                disarmRelaunch();
                const disarmed = !isRelaunchArmed();
                return armed && disarmed
                    ? pass(wasArmed ? "note: a relaunch was already pending and has been cancelled" : "")
                    : fail(`armed ${armed}, disarmed ${disarmed}`);
            },
        },
        {
            milestone: "M6a resume across prestige",
            name: "relaunch timer actually types into the terminal",
            active: true,
            verify: async () => {
                // Real verification, not just "it was armed": the timer clears itself only after a
                // submission succeeds, so still being armed after several attempt windows means it
                // never managed to reach the terminal.
                //
                // Polled rather than slept through, so this normally finishes in a second or two
                // instead of stalling the whole run on a fixed wait.
                disarmRelaunch();
                armRelaunch(800, "expr 31337");
                const deadline = Date.now() + 12000;
                while (isRelaunchArmed() && Date.now() < deadline) await ns.asleep(400);
                if (isRelaunchArmed()) {
                    return fail("timer never reached the terminal - check the sidebar selectors");
                }

                // Clearing the timer only proves the command was TYPED. The terminal input is a
                // controlled component, so a submit issued in the same tick as the value change
                // silently does nothing and the text just sits there - which is exactly what
                // happened after a real augmentation install. An empty input is the proof.
                await ns.asleep(700);
                const leftover = (doc().getElementById("terminal-input") as HTMLInputElement | null)?.value ?? "";
                return leftover.includes("expr")
                    ? fail(`command was typed but never submitted (input still reads "${leftover}")`)
                    : pass("typed and submitted; '31337' should be in the terminal");
            },
        },

        // ---------- M7: casino ----------
        {
            milestone: "M7  casino",
            name: "coin-flip RNG located and modelled",
            verify: () => {
                const rng = getBridge(version)?.BadRNG;
                if (!rng) return warn("BadRNG not found - the casino would be unavailable");
                if (rng.m !== 1024 || rng.a !== 341 || rng.c !== 1) {
                    return fail(`RNG constants changed: m=${rng.m} a=${rng.a} c=${rng.c}`);
                }
                // The generator must return to its start after exactly m steps (full period).
                let x = rng.x;
                for (let i = 0; i < rng.m; i++) x = (rng.a * x + rng.c) % rng.m;
                return x === rng.x
                    ? pass(`x=${rng.x}, period ${rng.m} verified`)
                    : fail("LCG did not return to its seed after m steps");
            },
        },
        {
            milestone: "M7  casino",
            name: "casino headroom remaining",
            verify: () => {
                const won = casinoWinnings(ns);
                return pass(`$${ns.format.number(won)} won since install (cap $10.00b)`);
            },
        },

        // ---------- M8: money engine ----------
        {
            milestone: "M8  money engine",
            name: "hacknet totals readable",
            verify: async () => {
                const totals = await dodge(ns, "WacnOS/helpers/getHacknetTotals.js") as {
                    nodes: number; levels: number; ram: number; cores: number;
                };
                return typeof totals?.nodes === "number"
                    ? pass(`${totals.nodes} nodes, ${totals.levels} levels, ${totals.ram}GB, ${totals.cores} cores`)
                    : fail("helper returned nothing");
            },
        },
        {
            milestone: "M8  money engine",
            name: "stock API uses post-3.0.0 names",
            verify: () => {
                // hasWSEAccount/hasTIXAPIAccess were REMOVED in 3.0.0; calling them throws.
                try {
                    const wse = ns.stock.hasWseAccount();
                    const tix = ns.stock.hasTixApiAccess();
                    return pass(`wse ${wse}, tix ${tix}, 4S ${ns.stock.has4SData()}`);
                } catch (err) {
                    return fail(`stock API call threw: ${String(err)}`);
                }
            },
        },

        // ---------- M9: decision engine ----------
        {
            milestone: "M9  decision engine",
            name: "decide() returns a usable decision",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return skip("no bridge");
                const decision = decide(ns, {
                    snap,
                    config: loadConfig(ns),
                    casinoWon: casinoWinnings(ns),
                    pendingBitVerse: false,
                    hacknetSatisfied: false,
                });
                return decision.phase && decision.note
                    ? pass(`[${decision.phase}] ${decision.step} - ${decision.note}`)
                    : fail("decide() returned an incomplete decision");
            },
        },
        {
            milestone: "M9  decision engine",
            name: "decide() is pure (same snapshot, same answer)",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return skip("no bridge");
                const ctx = {
                    snap, config: loadConfig(ns), casinoWon: casinoWinnings(ns),
                    pendingBitVerse: false, hacknetSatisfied: false,
                };
                const a = decide(ns, ctx);
                const b = decide(ns, ctx);
                return a.phase === b.phase && a.note === b.note
                    ? pass()
                    : fail(`decide() is not deterministic: ${a.phase} then ${b.phase}`);
            },
        },

        // ---------- M10: endgame ----------
        {
            milestone: "M10 endgame",
            name: "World Daemon requirements known for this BitNode",
            verify: () => {
                const node = ns.getResetInfo().currentNode;
                const need = worldDaemonHacking(node);
                const exists = ns.serverExists("w0r1d_d43m0n");
                return pass(`BitNode ${node} needs hacking ${need} (have ${ns.getHackingLevel()}); server on network: ${exists}`);
            },
        },
        {
            milestone: "M10 endgame",
            name: "Daedalus gate progress",
            verify: () => {
                const snap = snapshot(ns);
                if (!snap) return skip("no bridge");
                const player = ns.getPlayer();
                const parts = [
                    `augs ${snap.distinctOwned}/${DAEDALUS.augs}`,
                    `money ${ns.format.number(player.money)}/${ns.format.number(DAEDALUS.money)}`,
                    `hacking ${player.skills.hacking}/${DAEDALUS.hacking}`,
                ];
                return pass(parts.join(", "));
            },
        },
        {
            milestone: "M10 endgame",
            name: "BitVerse portal selectors (dry run)",
            active: true,
            verify: async () => {
                const target = nextBitNode(ns, loadConfig(ns));
                if (!byAriaPrefix(`BitNode-${target}:`) && !buttonContaining(`BitNode-${target}:`)) {
                    return skip("not on the BitVerse page - run this there to verify the portal");
                }
                const result = await clickBitVersePortal(ns, target, version, true);
                return result.ok ? pass(result.reason ?? "") : fail(result.reason ?? "dry run failed");
            },
        },
        {
            milestone: "M10 endgame",
            name: "city faction thresholds match the game's own numbers",
            verify: () => {
                // Guards against a typo in phases.ts silently stalling the ladder forever.
                const expected: Record<string, number> = {"Tian Di Hui": 1e6, "Sector-12": 15e6, Aevum: 40e6};
                const wrong = Object.entries(expected)
                    .filter(([f, money]) => CITY_FACTIONS[f]?.money !== money)
                    .map(([f]) => f);
                return wrong.length === 0 ? pass() : fail(`wrong money threshold for ${wrong.join(", ")}`);
            },
        },
    ].filter((check) => active || !check.active) as Check[];
}
