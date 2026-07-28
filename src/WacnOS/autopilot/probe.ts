import {NS} from "@ns";
import {bridgeOk, factionFavor, factionRep, snapshot} from "WacnOS/bridge/gamestate";
import {getBridge, rebuildBridge} from "WacnOS/bridge/webpack";
import {terminal} from "WacnOS/dom/terminal";
import {dismissModals, goTo, PageName} from "WacnOS/dom/nav";
import {byAriaPrefix, buttonContaining, doc, find} from "WacnOS/dom/doc";
import {buyHomeRam, openLocation, techVendorFor, travelTo} from "WacnOS/dom/actions";
import {backdoorFactionServers, FACTION_SERVERS, isBackdoored, pathTo} from "WacnOS/autopilot/backdoor";
import {acceptInvite, buyAugmentation, stopWork, startFactionWork} from "WacnOS/dom/actions";
import {planPurchases, repGoalFor} from "WacnOS/autopilot/plan";
import {armRelaunch, clearMarker, disarmRelaunch, readMarker, writeMarker} from "WacnOS/autopilot/resume";
import {casinoWinnings, farmCasino} from "WacnOS/dom/casino";
import {CASINO_LIMIT} from "WacnOS/autopilot/phases";
import {ensureHacknet, ensureInfra, ensureStocks, setSharing} from "WacnOS/autopilot/money";
import {loadConfig} from "WacnOS/config";
import {scanAllServers} from "lib/network-scan";
import {BACKDOOR_FACTIONS, BN1_LADDER, CITY_FACTIONS, DAEDALUS, INVITE_ALLOWLIST, NETBURNERS_REQ} from "WacnOS/autopilot/phases";

/**
 * Diagnostics for the two layers the autopilot can't run without: the webpack read-bridge and
 * the DOM driver. Neither has a unit test to lean on - the only real verification is comparing
 * what these print against what the game's own UI shows.
 *
 *   run WacnOS/autopilot/probe.js --dump          bridge reads (check these against the game UI)
 *   run WacnOS/autopilot/probe.js --terminal      terminal injection
 *   run WacnOS/autopilot/probe.js --nav           navigate to every page the autopilot uses
 *   run WacnOS/autopilot/probe.js --selectors     report which key selectors resolve right now
 *   run WacnOS/autopilot/probe.js --rebuild       force a bridge rebuild, then dump
 *   run WacnOS/autopilot/probe.js --vendor        open the local tech vendor, report its buttons
 *   run WacnOS/autopilot/probe.js --paths         faction server routes + backdoor state
 *   run WacnOS/autopilot/probe.js --travel Aevum  travel (SPENDS the $200k ticket)
 *   run WacnOS/autopilot/probe.js --homeram       buy one home RAM upgrade (SPENDS MONEY)
 *   run WacnOS/autopilot/probe.js --backdoor      backdoor every reachable faction server
 *   run WacnOS/autopilot/probe.js --ladder        the BN1 ladder and what blocks each rung
 *   run WacnOS/autopilot/probe.js --join CyberSec accept an invite (PERMANENT, allowlist-checked)
 *   run WacnOS/autopilot/probe.js --work CyberSec start hacking work for a faction
 *   run WacnOS/autopilot/probe.js --stopwork      stop whatever work is running
 *   run WacnOS/autopilot/probe.js --plan          dry-run the purchase planner + rep goals
 *   run WacnOS/autopilot/probe.js --buy "CyberSec:BitWire"   buy one aug (SPENDS MONEY)
 *   run WacnOS/autopilot/probe.js --arm-echo      SAFE test of the post-prestige relaunch timer
 *   run WacnOS/autopilot/probe.js --arm           arm the real relaunch command
 *   run WacnOS/autopilot/probe.js --marker        write/read/clear the resume marker file
 *   run WacnOS/autopilot/probe.js --disarm        cancel a pending relaunch timer
 *   run WacnOS/autopilot/probe.js --rng           casino RNG state + its next 12 predicted flips
 *   run WacnOS/autopilot/probe.js --casino        farm the casino to its $10b cap (needs Aevum)
 *   run WacnOS/autopilot/probe.js --money         one infrastructure pass (root/TOR/programs/stocks)
 *   run WacnOS/autopilot/probe.js --hacknet       grow the hacknet toward Netburners
 *   run WacnOS/autopilot/probe.js --share on|off  deploy or clear ns.share() threads
 *
 * --dump, --selectors, --paths, --ladder and --vendor are read-only and the right first checks.
 * --travel, --homeram, --backdoor and --join change the game; --join is irreversible.
 */
export async function main(ns: NS): Promise<void> {
    const flags = ns.flags([
        ["dump", false],
        ["terminal", false],
        ["nav", false],
        ["selectors", false],
        ["rebuild", false],
        ["travel", ""],
        ["vendor", false],
        ["homeram", false],
        ["paths", false],
        ["backdoor", false],
        ["ladder", false],
        ["join", ""],
        ["work", ""],
        ["stopwork", false],
        ["plan", false],
        ["buy", ""],
        ["arm", false],
        ["arm-echo", false],
        ["marker", false],
        ["disarm", false],
        ["rng", false],
        ["casino", false],
        ["money", false],
        ["hacknet", false],
        ["share", ""],
    ]);

    const version = String(ns.ui.getGameInfo().version);
    const travelTarget = String(flags.travel);
    const joinTarget = String(flags.join);
    const workTarget = String(flags.work);
    const any = flags.dump || flags.terminal || flags.nav || flags.selectors || flags.rebuild
        || !!travelTarget || flags.vendor || flags.homeram || flags.paths || flags.backdoor
        || flags.ladder || !!joinTarget || !!workTarget || flags.stopwork
        || flags.plan || !!String(flags.buy)
        || flags.arm || flags["arm-echo"] || flags.marker || flags.disarm
        || flags.rng || flags.casino || flags.money || flags.hacknet || !!String(flags.share);

    if (flags.rebuild) {
        rebuildBridge(version);
        ns.tprint("INFO  bridge rebuilt");
    }
    if (flags.dump || flags.rebuild || !any) dumpBridge(ns, version);
    if (flags.selectors) reportSelectors(ns);
    if (flags.nav) await probeNav(ns, version);
    if (flags.terminal) await probeTerminal(ns, version);
    if (travelTarget) await probeTravel(ns, travelTarget, version);
    if (flags.vendor) await probeVendor(ns, version);
    if (flags.homeram) await probeHomeRam(ns, version);
    if (flags.paths) await probePaths(ns);
    if (flags.backdoor) await probeBackdoor(ns, version);
    if (flags.ladder) probeLadder(ns);
    if (joinTarget) await probeJoin(ns, joinTarget, version);
    if (workTarget) await probeWork(ns, workTarget, version);
    if (flags.stopwork) {
        const r = await stopWork();
        ns.tprint(`=== stop work === ${r.ok ? "OK" : `FAIL - ${r.reason}`}`);
    }
    if (flags.plan) probePlan(ns);
    if (String(flags.buy)) await probeBuy(ns, String(flags.buy), version);
    if (flags["arm-echo"]) probeArmEcho(ns);
    if (flags.arm) probeArm(ns);
    if (flags.marker) probeMarker(ns);
    if (flags.disarm) {
        disarmRelaunch();
        ns.tprint("=== disarm === any pending relaunch timer cancelled");
    }
    if (flags.rng) probeRng(ns, version);
    if (flags.casino) await probeCasino(ns, version);
    if (flags.money) await probeMoney(ns, version);
    if (flags.hacknet) await probeHacknet(ns);
    if (String(flags.share)) await probeShare(ns, String(flags.share));
}

/**
 * The SAFE version of the relaunch test: arms the timer with a harmless echo instead of the real
 * relaunch command, then kills this script. If the timer works, the echo appears in the terminal a
 * few seconds later - proving the mechanism without needing an actual prestige.
 *
 * Run this BEFORE trusting anything that installs augmentations.
 */
function probeArmEcho(ns: NS): void {
    ns.tprint("=== arm relaunch (echo test) ===");
    ns.tprint("  arming a 6s timer that types a harmless command");
    ns.tprint("  watch the terminal - 'expr 31337' should appear by itself");
    ns.tprint("  switch to another tab first to prove it navigates back to the Terminal");
    armRelaunch(6000, "expr 31337");
}

/** Arms the real relaunch command without performing any irreversible action. */
function probeArm(ns: NS): void {
    ns.tprint("=== arm relaunch (real command) ===");
    ns.tprint(`  in ~8s the terminal should run: run WacnOS/WLoader.js autopilot`);
    armRelaunch();
}

function probeMarker(ns: NS): void {
    ns.tprint("=== resume marker ===");
    const existing = readMarker(ns);
    ns.tprint(`  current: ${existing ? JSON.stringify(existing) : "none"}`);

    writeMarker(ns, {
        stage: "install",
        bitNode: ns.getResetInfo().currentNode,
        handoff: "wacnos",
        route: "bn1-to-bn4",
        writtenAt: Date.now(),
    });
    const readBack = readMarker(ns);
    ns.tprint(`  wrote and read back: ${readBack ? "OK" : "FAIL"}`);

    clearMarker(ns);
    ns.tprint(`  cleared: ${readMarker(ns) === null ? "OK" : "FAIL"}`);
}

/**
 * Read-only dry run of the purchase planner. This is the check that the cost recomputation in
 * bridge/gamestate.ts is right - compare the first row's price against what the game's own
 * augmentation shop shows for that augmentation.
 */
function probePlan(ns: NS): void {
    const snap = snapshot(ns);
    ns.tprint("=== purchase plan (dry run) ===");
    if (!snap) {
        ns.tprint("  ERROR bridge unavailable");
        return;
    }

    const joined = Object.values(snap.factions).filter((f) => f.joined).map((f) => f.name);
    ns.tprint(`  money ${ns.format.number(snap.money)}   queued ${snap.queued.length}   price step x${snap.priceMultiplier.toFixed(3)} per queued aug`);

    const plan = planPurchases(snap, joined, {allowNFG: false, reserve: 1e6});
    if (plan.length === 0) {
        ns.tprint("  nothing affordable within reputation right now");
    } else {
        let total = 0;
        for (const buy of plan) {
            total += buy.moneyCost;
            ns.tprint(`  $${ns.format.number(buy.moneyCost).padStart(9)}  ${buy.aug.padEnd(38)} from ${buy.faction}`);
        }
        ns.tprint(`  ${plan.length} augs, total ${ns.format.number(total)}`);
        ns.tprint("  (most-expensive-first is intentional: each queued aug multiplies later prices)");
    }

    ns.tprint("  rep goals for joined factions:");
    for (const faction of joined) {
        const goal = repGoalFor(snap, faction);
        if (goal <= 0) continue;
        const rep = snap.factions[faction].rep;
        ns.tprint(`    ${faction.padEnd(18)} ${ns.format.number(rep)} / ${ns.format.number(goal)}${rep >= goal ? "  DONE" : ""}`);
    }
}

/**
 * Read-only: confirms the casino RNG was found and shows the flips it predicts next. Never calls
 * random() - that would advance the generator and desync the prediction.
 */
function probeRng(ns: NS, version: string): void {
    ns.tprint("=== casino RNG ===");
    const rng = getBridge(version)?.BadRNG;
    if (!rng) {
        ns.tprint("  MISSING - the casino would run degraded (fingerprint m=1024, a=341, c=1)");
        return;
    }
    ns.tprint(`  found: x=${rng.x}  (x' = (${rng.a}x + ${rng.c}) mod ${rng.m})`);
    ns.tprint(`  winnings so far: ${ns.format.number(casinoWinnings(ns))} / ${ns.format.number(CASINO_LIMIT)}`);

    let x = rng.x;
    const next: string[] = [];
    for (let i = 0; i < 12; i++) {
        x = (rng.a * x + rng.c) % rng.m;
        next.push(x / rng.m < 0.5 ? "H" : "T");
    }
    ns.tprint(`  next 12 flips predicted: ${next.join(" ")}`);
    ns.tprint("  (start a coin flip manually and check these against real results)");
}

async function probeCasino(ns: NS, version: string): Promise<void> {
    ns.tprint("=== farm casino (needs to be in Aevum) ===");
    const before = casinoWinnings(ns);
    try {
        const result = await farmCasino(ns, version);
        ns.tprint(`  ${result.ok ? "OK  " : "FAIL"} ${ns.format.number(before)} -> ${ns.format.number(casinoWinnings(ns))}${result.reason ? ` - ${result.reason}` : ""}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

/** Runs one infrastructure pass: root, hackloop, TOR, port openers, stock unlocks. Spends money. */
async function probeMoney(ns: NS, version: string): Promise<void> {
    ns.tprint("=== infrastructure pass (MAY SPEND MONEY) ===");
    const config = loadConfig(ns);
    try {
        const infra = await ensureInfra(ns, config, version);
        ns.tprint(`  rooted ${infra.rooted} new server(s)`);
        ns.tprint(`  TOR ${infra.tor}   port openers ${infra.programs}/5   Formulas.exe ${ns.fileExists("Formulas.exe", "home")}`);
        await ensureStocks(ns, config, config.reserveMoney);
        ns.tprint(`  stocks: wse ${ns.stock.hasWseAccount()}  tix ${ns.stock.hasTixApiAccess()}  4S ${ns.stock.has4SData()}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

async function probeHacknet(ns: NS): Promise<void> {
    ns.tprint("=== hacknet toward Netburners (SPENDS MONEY) ===");
    const config = loadConfig(ns);
    try {
        const state = await ensureHacknet(ns, config);
        ns.tprint(`  nodes ${state.nodes}  levels ${state.levels}/${NETBURNERS_REQ.levels}  ram ${state.ram}/${NETBURNERS_REQ.ram}  cores ${state.cores}/${NETBURNERS_REQ.cores}`);
        ns.tprint(`  requirements met: ${state.satisfied}   (also needs hacking ${NETBURNERS_REQ.hacking}, have ${ns.getHackingLevel()})`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

async function probeShare(ns: NS, mode: string): Promise<void> {
    ns.tprint(`=== share ram ${mode} ===`);
    try {
        await setSharing(ns, mode !== "off");
        const running = scanAllServers(ns)
            .flatMap((h) => ns.ps(h))
            .filter((p) => p.filename === "WacnOS/helpers/shareRam.js");
        const threads = running.reduce((sum, p) => sum + p.threads, 0);
        ns.tprint(`  ${running.length} process(es), ${threads} threads`);
        if (threads > 0) ns.tprint(`  faction rep multiplier ~ ${(1 + Math.log(threads) / 25).toFixed(3)}x`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

async function probeBuy(ns: NS, spec: string, version: string): Promise<void> {
    // --buy "CyberSec:BitWire"
    const [faction, aug] = spec.split(":");
    if (!faction || !aug) {
        ns.tprint('ERROR --buy expects "Faction:Augmentation Name"');
        return;
    }
    ns.tprint(`=== buy "${aug}" from ${faction} (SPENDS MONEY) ===`);
    try {
        const result = await buyAugmentation(ns, faction, aug, version,
            (name) => snapshot(ns)?.queued.filter((q) => q === name).length ?? 0);
        ns.tprint(`  ${result.ok ? "OK  " : "FAIL"} ${result.reason ?? `queued: ${snapshot(ns)?.queued.join(", ")}`}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

/** Read-only: the whole BN1 ladder with what's blocking each rung. */
function probeLadder(ns: NS): void {
    const snap = snapshot(ns);
    ns.tprint("=== BN1 ladder ===");
    if (!snap) {
        ns.tprint("  ERROR bridge unavailable");
        return;
    }

    const player = ns.getPlayer();
    ns.tprint(`  city ${player.city}   money ${ns.format.number(player.money)}   hacking ${player.skills.hacking}`);

    for (const faction of BN1_LADDER) {
        const state = snap.factions[faction];
        if (!state) {
            ns.tprint(`  ??   ${faction} - not in the bridge's faction list`);
            continue;
        }
        const augs = state.augs.filter((a) => !snap.augs[a]?.owned && !snap.augs[a]?.queued).length;
        const mark = state.joined ? "IN  " : state.invited ? "INV " : state.banned ? "BAN " : "--  ";
        ns.tprint(`  ${mark} ${faction.padEnd(16)} rep ${ns.format.number(state.rep).padStart(9)}  favor ${String(Math.floor(state.favor)).padStart(4)}  ${augs} augs to buy`);
        if (!state.joined && !state.invited) ns.tprint(`       ${blockedBy(ns, faction)}`);
    }

    ns.tprint(`  distinct installed augs ${snap.distinctOwned} / ${DAEDALUS.augs} for Daedalus`);
    const pending = snap.invitations.filter((f) => !INVITE_ALLOWLIST.has(f));
    if (pending.length > 0) ns.tprint(`  IGNORED invites (would ban ladder factions): ${pending.join(", ")}`);
}

function blockedBy(ns: NS, faction: string): string {
    const player = ns.getPlayer();
    const server = BACKDOOR_FACTIONS[faction];
    if (server) {
        const need = ns.serverExists(server) ? ns.getServerRequiredHackingLevel(server) : 0;
        return `needs backdoor on ${server} (hacking ${need}, have ${player.skills.hacking})`;
    }
    const city = CITY_FACTIONS[faction];
    if (city) {
        const parts: string[] = [];
        if (!city.cities.includes(player.city)) parts.push(`be in ${city.cities.join(" or ")}`);
        if (player.money < city.money) parts.push(`$${ns.format.number(city.money)}`);
        if (player.skills.hacking < city.hacking) parts.push(`hacking ${city.hacking}`);
        return parts.length ? `needs ${parts.join(" + ")}` : "requirements met - waiting for the invite tick";
    }
    if (faction === "Netburners") {
        return `needs hacking ${NETBURNERS_REQ.hacking} + hacknet ${NETBURNERS_REQ.levels} levels / ${NETBURNERS_REQ.ram}GB / ${NETBURNERS_REQ.cores} cores`;
    }
    return "";
}

async function probeJoin(ns: NS, faction: string, version: string): Promise<void> {
    ns.tprint(`=== join ${faction} (PERMANENT) ===`);
    try {
        const result = await acceptInvite(ns, faction, INVITE_ALLOWLIST, version);
        ns.tprint(`  ${result.ok ? "OK  " : "FAIL"} ${result.reason ?? `joined; factions now: ${ns.getPlayer().factions.length}`}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

async function probeWork(ns: NS, faction: string, version: string): Promise<void> {
    ns.tprint(`=== work for ${faction} ===`);
    try {
        const result = await startFactionWork(
            ns, faction, "hacking", version,
            (f) => snapshot(ns)?.workingFor === f,
            (f) => factionRep(ns, f),
        );
        ns.tprint(`  ${result.ok ? "OK  " : "FAIL"} ${result.reason ?? `working for ${snapshot(ns)?.workingFor}`}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

/** Read-only: shows the connect chain and state for each faction server. Safe to run anytime. */
async function probePaths(ns: NS): Promise<void> {
    ns.tprint("=== faction server routes ===");
    ns.tprint(`  hacking level ${ns.getHackingLevel()}`);
    for (const [faction, host] of Object.entries(FACTION_SERVERS)) {
        if (!ns.serverExists(host)) {
            ns.tprint(`  -- ${host} does not exist`);
            continue;
        }
        const path = pathTo(ns, host);
        const need = ns.getServerRequiredHackingLevel(host);
        const done = await isBackdoored(ns, host);
        const reachable = need <= ns.getHackingLevel();
        ns.tprint(`  ${done ? "DONE" : reachable ? "RDY " : "    "} ${host.padEnd(14)} (${faction}) needs hacking ${String(need).padStart(4)}, root ${ns.hasRootAccess(host)}`);
        ns.tprint(`       connect ${path ? path.join(";connect ") : "NO ROUTE"}`);
    }
}

async function probeBackdoor(ns: NS, version: string): Promise<void> {
    ns.tprint("=== backdoor reachable faction servers ===");
    ns.tprint("  stay off the terminal while this runs");
    try {
        const done = await backdoorFactionServers(ns, version);
        ns.tprint(`  OK   backdoored: ${done.join(", ") || "nothing new was reachable"}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

async function probeTravel(ns: NS, city: string, version: string): Promise<void> {
    ns.tprint(`=== travel to ${city} ($200k ticket) ===`);
    ns.tprint(`  currently in ${ns.getPlayer().city}`);
    try {
        const result = await travelTo(ns, city, version);
        ns.tprint(`  ${result.ok ? "OK  " : "FAIL"} now in ${ns.getPlayer().city}${result.reason ? ` - ${result.reason}` : ""}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

async function probeVendor(ns: NS, version: string): Promise<void> {
    const city = ns.getPlayer().city;
    const vendor = techVendorFor(city);
    ns.tprint(`=== tech vendor in ${city} ===`);
    if (!vendor) {
        ns.tprint(`  -- ${city} has no tech vendor (expected for Chongqing / New Tokyo)`);
        return;
    }
    try {
        const result = await openLocation(ns, vendor, version);
        ns.tprint(`  ${result.ok ? "OK  " : "FAIL"} opened "${vendor}"`);
        ns.tprint(`  TOR button        ${buttonContaining("Purchase TOR router") ? "found" : "-- (already owned, or not on this page)"}`);
        ns.tprint(`  home RAM button   ${buttonContaining("Upgrade 'home' RAM") ? "found" : "--"}`);
        ns.tprint(`  home cores button ${buttonContaining("Upgrade 'home' cores") ? "found" : "--"}`);
        ns.tprint(`  hasTorRouter()    ${ns.hasTorRouter()}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

async function probeHomeRam(ns: NS, version: string): Promise<void> {
    ns.tprint("=== buy home RAM (SPENDS MONEY) ===");
    const before = ns.getServerMaxRam("home");
    try {
        const result = await buyHomeRam(ns, version);
        ns.tprint(`  ${result.ok ? "OK  " : "FAIL"} ${before}GB -> ${ns.getServerMaxRam("home")}GB${result.reason ? ` - ${result.reason}` : ""}`);
    } catch (err) {
        ns.tprint(`  FAIL ${String(err)}`);
    }
}

function dumpBridge(ns: NS, version: string): void {
    ns.tprint("=== bridge ===");
    ns.tprint(`game version      ${version}`);

    const bridge = getBridge(version);
    if (!bridge) {
        ns.tprint("ERROR bridge unavailable - fingerprints matched nothing. Autopilot would run DEGRADED.");
        return;
    }

    ns.tprint(`Player            ${bridge.Player ? "found" : "MISSING"}`);
    ns.tprint(`Factions          ${Object.keys(bridge.Factions).length} entries`);
    ns.tprint(`Augmentations     ${Object.keys(bridge.Augmentations).length} entries`);
    ns.tprint(`nodeMults         ${bridge.nodeMults ? `money x${bridge.nodeMults.AugmentationMoneyCost}, rep x${bridge.nodeMults.AugmentationRepCost}` : "MISSING (assuming 1x - wrong only in BN3)"}`);
    ns.tprint(`built for node    ${bridge.node}`);
    ns.tprint(`Router            ${bridge.Router ? "found" : "MISSING (goTo loses its tier-3 fallback)"}`);
    ns.tprint(`bridgeOk()        ${bridgeOk(ns)}`);

    const snap = snapshot(ns);
    if (!snap) {
        ns.tprint("ERROR snapshot() returned null despite a built bridge.");
        return;
    }

    ns.tprint("=== player ===");
    ns.tprint(`money             ${ns.format.number(snap.money)}   (ns says ${ns.format.number(ns.getPlayer().money)})`);
    ns.tprint(`installed augs    ${snap.distinctOwned}   (ns.getResetInfo says ${ns.getResetInfo().ownedAugs.size})`);
    ns.tprint(`queued augs       ${snap.queued.length}  -> ${snap.queued.join(", ") || "none"}`);
    ns.tprint(`joined factions   ${Object.values(snap.factions).filter((f) => f.joined).length}`);
    ns.tprint(`pending invites   ${snap.invitations.join(", ") || "none"}`);
    ns.tprint(`working for       ${snap.workingFor ?? "nothing"}${snap.focused ? " (focused)" : ""}`);

    ns.tprint("=== daedalus ===");
    ns.tprint(`rep               ${ns.format.number(factionRep(ns, "Daedalus") ?? -1)} / 2.50M for The Red Pill`);
    ns.tprint(`favor             ${factionFavor(ns, "Daedalus") ?? -1}  (150 unlocks donation)`);

    ns.tprint("=== joined factions ===");
    for (const faction of Object.values(snap.factions)) {
        if (!faction.joined) continue;
        const unowned = faction.augs.filter((a) => !snap.augs[a]?.owned && !snap.augs[a]?.queued).length;
        ns.tprint(`  ${faction.name.padEnd(22)} rep ${ns.format.number(faction.rep).padStart(9)}  favor ${String(Math.floor(faction.favor)).padStart(4)}  ${unowned} augs unowned`);
    }

    ns.tprint("=== 10 cheapest unowned augs (compare these against the game UI) ===");
    const affordable = Object.values(snap.augs)
        .filter((a) => !a.owned && !a.queued && !a.isNFG)
        .sort((a, b) => a.moneyCost - b.moneyCost)
        .slice(0, 10);
    for (const aug of affordable) {
        ns.tprint(`  ${aug.name.padEnd(38)} $${ns.format.number(aug.moneyCost).padStart(9)}  rep ${ns.format.number(aug.repCost).padStart(8)}  [${aug.factions.slice(0, 3).join(", ")}]`);
    }
}

function reportSelectors(ns: NS): void {
    ns.tprint("=== selector health ===");
    const checks: [string, () => unknown][] = [
        ["#terminal-input", () => doc().getElementById("terminal-input")],
        ["sidebar Terminal", () => find("//div[contains(@class,'MuiDrawer-root')]//*[normalize-space(text())='Terminal']")],
        ["sidebar Factions", () => find("//div[contains(@class,'MuiDrawer-root')]//*[normalize-space(text())='Factions']")],
        ["sidebar City", () => find("//div[contains(@class,'MuiDrawer-root')]//*[normalize-space(text())='City']")],
        ["open modal", () => find("//div[contains(@class,'MuiModal-root')]")],
        ["work unfocus button", () => find("//button[contains(., 'Do something else simultaneously')]")],
        ["Focus button", () => buttonContaining("Focus")],
        ["aug filter box", () => find("//input[@placeholder='Filter augmentations']")],
        ["BitVerse portal BN4", () => byAriaPrefix("BitNode-4:")],
    ];

    for (const [label, probe] of checks) {
        let found = false;
        try {
            found = !!probe();
        } catch {
            found = false;
        }
        ns.tprint(`  ${found ? "OK  " : "--  "} ${label}`);
    }
    ns.tprint("  (a '--' is only a problem if you're on the page that should show it)");
}

async function probeNav(ns: NS, version: string): Promise<void> {
    ns.tprint("=== navigation ===");
    const pages: PageName[] = ["Stats", "Factions", "Augmentations", "City", "Hacknet", "Terminal"];
    for (const page of pages) {
        try {
            const ok = await goTo(page, version);
            ns.tprint(`  ${ok ? "OK  " : "FAIL"} ${page}`);
        } catch (err) {
            ns.tprint(`  FAIL ${page} - ${String(err)}`);
        }
        await ns.asleep(400);
    }
    await dismissModals();
}

async function probeTerminal(ns: NS, version: string): Promise<void> {
    ns.tprint("=== terminal injection ===");
    ns.tprint("watch the terminal - 'home' then 'scan' should appear and execute");
    try {
        await terminal("home", version);
        await ns.asleep(500);
        await terminal("scan", version);
        ns.tprint("OK    both commands submitted");
    } catch (err) {
        ns.tprint(`FAIL  ${String(err)}`);
    }
}
