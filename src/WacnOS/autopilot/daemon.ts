import {NS} from "@ns";
import {WacnPorts} from "WacnOS/ports";
import {loadConfig, WacnOSConfig} from "WacnOS/config";
import {AutopilotStatus, Phase, publishAutopilotStatus} from "WacnOS/status";
import {nextBitNode, routeLabel} from "WacnOS/autopilot/route";
import {GameSnapshot, snapshot} from "WacnOS/bridge/gamestate";
import {decide, Decision} from "WacnOS/autopilot/decide";
import {DAEDALUS, MIN_HOME_RAM, worldDaemonHacking, WORLD_DAEMON} from "WacnOS/autopilot/phases";
import {INVITE_ALLOWLIST} from "WacnOS/autopilot/phases";
import {guarded, guardState} from "WacnOS/dom/guard";
import {
    acceptInvite,
    buyAugmentation,
    clickBitVersePortal,
    commitInstall,
    stopWork,
    travelTo,
    startFactionWork,
} from "WacnOS/dom/actions";
import {farmCasino, casinoWinnings} from "WacnOS/dom/casino";
import {backdoorHost, isBackdoored, pathTo} from "WacnOS/autopilot/backdoor";
import {ensureHacknet, ensureInfra, ensureStocks, maybeUpgradeHomeRam, setSharing} from "WacnOS/autopilot/money";
import {prepareForRestart, readMarker} from "WacnOS/autopilot/resume";
import {terminalSeq} from "WacnOS/dom/terminal";
import {sleep} from "WacnOS/dom/doc";
import {WacnPorts as Ports} from "WacnOS/ports";

const TICK_MS = 5000;
const DEGRADED_RETRY_MS = 30000;

/**
 * WacnOS's autopilot - plays a BitNode to completion without Source-File 4.
 *
 * Everything SphyxOS's autopilot does through ns.singularity.* has to be reached another way here:
 * state Singularity would report (faction reputation, pending invites, augmentation prices) is READ
 * through the webpack bridge in WacnOS/bridge/, and every ACTION (joining, working, buying,
 * installing, travelling, the BitVerse portal) is performed against the real UI from WacnOS/dom/.
 *
 * The loop is stateless between ticks - every decision is re-derived from a fresh snapshot - so an
 * unexpected kill, a page reload, or an augmentation install can never leave it acting on a stale
 * belief. That property is what makes the whole thing survivable without a restart callback.
 *
 * NOTE: never reference ns.singularity.* here (static RAM is charged on the token even in an
 * unreachable branch) and never the bare `document`/`window` identifiers - DOM access goes through
 * globalThis["document"] in WacnOS/dom/doc.ts.
 */
export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();
    ns.ui.setTailTitle("WacnOS - Autopilot");
    ns.ui.resizeTail(620, 340);

    // Refuse to start into a deadlock. On a fresh node this script would occupy nearly all of
    // home, leaving nothing for the hacking loop or even for a single dodge helper - so it would
    // hold the RAM while nothing earned money or experience, waiting forever on a hacking level
    // that could never rise. The hacking loop alone is the correct opening move.
    const homeRam = ns.getServerMaxRam("home");
    if (homeRam < MIN_HOME_RAM) {
        ns.tprint(`ERROR WacnOS autopilot needs ${MIN_HOME_RAM}GB of home RAM (have ${homeRam}GB).`);
        ns.tprint("      Run WacnOS/launcher/hackloop.js on its own until home is upgraded;");
        ns.tprint("      the autopilot would otherwise starve its own workers and stall.");
        ns.toast(`WacnOS autopilot needs ${MIN_HOME_RAM}GB home RAM (have ${homeRam}GB)`, "warning", null);
        return;
    }

    ns.clearPort(WacnPorts.AUTOPILOT_PID);
    ns.writePort(WacnPorts.AUTOPILOT_PID, ns.pid);
    ns.atExit(() => ns.clearPort(WacnPorts.AUTOPILOT_PID));

    const version = String(ns.ui.getGameInfo().version);
    let config = loadConfig(ns);
    let stopping = false;
    let sharing = false;
    let lastBridgeTry = 0;

    // A marker surviving into a running daemon means the relaunch happened but the portal click
    // hadn't been made yet - resume it rather than restarting the ladder.
    const marker = readMarker(ns);
    const pendingBitVerse = marker?.stage === "bitverse" && marker.bitNode !== ns.getResetInfo().currentNode;

    while (!stopping) {
        drainCommands(ns, (cmd) => {
            if (cmd === "pause") {
                guardState.paused = true;
                guardState.reason = "paused from the loader";
            } else if (cmd === "resume" || cmd === "skip") {
                guardState.paused = false;
                guardState.reason = "";
            } else if (cmd === "stop") {
                stopping = true;
            } else if (cmd === "reload") {
                config = loadConfig(ns);
            }
        });
        if (stopping) break;

        if (guardState.paused) {
            publish(ns, config, {phase: "PAUSED", step: "--", note: guardState.reason}, null);
            await ns.asleep(1000);
            continue;
        }

        const snap = snapshot(ns);

        // Infrastructure runs in every state, including DEGRADED - it's all plain ns.* and it's
        // what keeps income and hacking level rising while anything else is stuck.
        await ensureInfra(ns, config, version).catch(() => undefined);
        await ensureStocks(ns, config, config.reserveMoney).catch(() => undefined);

        if (!snap) {
            if (Date.now() - lastBridgeTry > DEGRADED_RETRY_MS) {
                lastBridgeTry = Date.now();
                ns.print("WARN  bridge unavailable - running infrastructure only");
            }
            publish(ns, config, {
                phase: "DEGRADED",
                step: "--",
                note: "webpack bridge unavailable; not buying or installing",
            }, null);
            render(ns, config, {phase: "DEGRADED", step: "--", note: "bridge unavailable"}, null, sharing);
            await ns.asleep(TICK_MS);
            continue;
        }

        const hacknet = await ensureHacknet(ns, config).catch(() => ({satisfied: false} as { satisfied: boolean }));

        const decision = decide(ns, {
            snap,
            config,
            casinoWon: casinoWinnings(ns),
            pendingBitVerse,
            hacknetSatisfied: hacknet.satisfied,
        });

        // Sharing trades hacking income for a faction-reputation multiplier, so it's only on
        // during the phases where reputation is the bottleneck.
        const wantShare = config.useShare && (decision.phase === "DAEDALUS_REP" || decision.phase === "FACTION_REP");
        if (wantShare !== sharing) {
            await setSharing(ns, wantShare).catch(() => undefined);
            sharing = wantShare;
            ns.writePort(WacnPorts.HACKLOOP_CMD, wantShare ? "xponly" : "money");
        }

        publish(ns, config, decision, snap);
        render(ns, config, decision, snap, sharing);

        const committed = await applyDecision(ns, config, decision, snap, version);
        if (committed) return; // an install or portal click - this script is about to be killed

        await ns.asleep(TICK_MS);
    }

    ns.print("autopilot stopped");
}

/** Executes one decision. Returns true if the game is about to restart and this script should exit. */
async function applyDecision(
    ns: NS,
    config: WacnOSConfig,
    decision: Decision,
    snap: GameSnapshot,
    version: string,
): Promise<boolean> {
    const opts = {pauseOnMiss: config.pauseOnSelectorMiss};

    switch (decision.phase) {
        case "MONEY_CASINO":
            if (decision.city) {
                await guarded(ns, "travel to the casino", () => travelTo(ns, decision.city as string, version), opts);
            } else {
                await guarded(ns, "farm casino", () => farmCasino(ns, version), opts);
            }
            return false;

        case "FACTION_JOIN":
            await guarded(ns, `join ${decision.faction}`,
                () => acceptInvite(ns, decision.faction as string, INVITE_ALLOWLIST, version), opts);
            return false;

        case "FACTION_UNLOCK": {
            const unlock = decision.unlock;
            if (!unlock) return false;
            if (unlock.kind === "backdoor") {
                await guarded(ns, `backdoor ${unlock.host}`, () => backdoorHost(ns, unlock.host, version), opts);
            } else if (unlock.kind === "travel") {
                await guarded(ns, `travel to ${unlock.city}`, () => travelTo(ns, unlock.city, version), opts);
            } else if (unlock.kind === "hacknet") {
                await ensureHacknet(ns, config).catch(() => undefined);
            } else {
                // Waiting on a stat or money - keep the economy running and let the hacking loop
                // do its work.
                await maybeUpgradeHomeRam(ns, version).catch(() => undefined);
            }
            return false;
        }

        case "FACTION_REP":
        case "DAEDALUS_REP": {
            const faction = decision.faction as string;
            // Re-assert every tick: a terminal injection or a dialog can silently drop work.
            if (snap.workingFor !== faction) {
                await guarded(ns, `work for ${faction}`, () => startFactionWork(
                    ns, faction, "hacking", version,
                    (f) => snapshot(ns)?.workingFor === f,
                    (f) => snapshot(ns)?.factions[f]?.rep ?? null,
                ), opts);
            }
            return false;
        }

        case "BUY_AUGS": {
            const buy = decision.buys?.[0];
            if (!buy) return false;
            await guarded(ns, `buy ${buy.aug}`, () => buyAugmentation(
                ns, buy.faction, buy.aug, version,
                (name) => snapshot(ns)?.queued.filter((q) => q === name).length ?? 0,
            ), opts);
            return false;
        }

        case "RED_PILL":
            await guarded(ns, "buy The Red Pill", () => buyAugmentation(
                ns, "Daedalus", DAEDALUS.redPill, version,
                (name) => snapshot(ns)?.queued.filter((q) => q === name).length ?? 0,
            ), opts);
            return false;

        case "INSTALL": {
            // Everything after the click is unreachable - the game kills this script. The marker
            // and the relaunch timer MUST be in place first.
            await stopWork();
            prepareForRestart(ns, {
                stage: "install",
                bitNode: ns.getResetInfo().currentNode,
                handoff: config.nextNodeDriver,
                route: config.route,
                writtenAt: Date.now(),
            });
            ns.print("INFO  installing augmentations - relaunch armed");
            await guarded(ns, "install augmentations", () => commitInstall(ns, version), opts);
            return true;
        }

        case "WD_BACKDOOR":
            return runWorldDaemon(ns, config, version);

        case "BITVERSE": {
            const target = nextBitNode(ns, config);
            prepareForRestart(ns, {
                stage: "bitverse",
                bitNode: target,
                handoff: config.nextNodeDriver,
                route: config.route,
                writtenAt: Date.now(),
            });
            ns.print(`INFO  entering BitNode ${target} - relaunch armed`);
            await guarded(ns, `enter BitNode ${target}`,
                () => clickBitVersePortal(ns, target, version), opts);
            return true;
        }

        default:
            await maybeUpgradeHomeRam(ns, version).catch(() => undefined);
            return false;
    }
}

/**
 * The endgame: root and backdoor w0r1d_d43m0n, which routes straight to the BitVerse
 * (Terminal/commands/backdoor.ts:60).
 *
 * The marker is written BEFORE issuing the command because the backdoor is a timed action - the
 * game can land us in the BitVerse while this script is still asleep waiting for it.
 */
async function runWorldDaemon(ns: NS, config: WacnOSConfig, version: string): Promise<boolean> {
    const node = ns.getResetInfo().currentNode;
    const needed = worldDaemonHacking(node);

    if (!ns.serverExists(WORLD_DAEMON.host)) {
        ns.print(`WARN  ${WORLD_DAEMON.host} is not on the network yet`);
        return false;
    }
    if (ns.getHackingLevel() < needed) {
        ns.print(`INFO  hacking ${ns.getHackingLevel()} / ${needed} for ${WORLD_DAEMON.host}`);
        ns.writePort(Ports.HACKLOOP_CMD, "xponly");
        return false;
    }
    if (await isBackdoored(ns, WORLD_DAEMON.host)) {
        return false; // already done; the BitVerse decision takes over next tick
    }

    const path = pathTo(ns, WORLD_DAEMON.host);
    if (!path) {
        ns.print(`WARN  no route to ${WORLD_DAEMON.host} - is The Red Pill installed?`);
        return false;
    }

    prepareForRestart(ns, {
        stage: "bitverse",
        bitNode: nextBitNode(ns, config),
        handoff: config.nextNodeDriver,
        route: config.route,
        writtenAt: Date.now(),
    });

    ns.print(`INFO  backdooring ${WORLD_DAEMON.host} - this routes straight to the BitVerse`);
    await terminalSeq(["home", ...path.map((h) => `connect ${h}`), "backdoor"], version);
    await sleep(ns.getHackTime(WORLD_DAEMON.host) / 4 + 5000);
    return true;
}

function drainCommands(ns: NS, onCommand: (cmd: string) => void): void {
    while (ns.peek(WacnPorts.AUTOPILOT_CMD) !== "NULL PORT DATA") {
        onCommand(String(ns.readPort(WacnPorts.AUTOPILOT_CMD)));
    }
}

function publish(
    ns: NS,
    config: WacnOSConfig,
    decision: { phase: Phase; step: string; note: string; faction?: string },
    snap: GameSnapshot | null,
): void {
    const player = ns.getPlayer();
    const reset = ns.getResetInfo();
    const daedalus = snap?.factions["Daedalus"];

    const status: AutopilotStatus = {
        phase: decision.phase,
        label: decision.note,
        step: decision.step,
        bitNode: reset.currentNode,
        nextBitNode: nextBitNode(ns, config),
        route: routeLabel(config),
        moveOn: config.moveOnNextNode,
        ownedAugs: snap?.distinctOwned ?? reset.ownedAugs.size,
        queuedAugs: snap?.queued.length ?? 0,
        augGoal: DAEDALUS.augs,
        daedalusRep: daedalus?.rep ?? 0,
        daedalusRepGoal: DAEDALUS.redPillRep,
        daedalusEtaMs: -1,
        money: player.money,
        hacking: player.skills.hacking,
        paused: guardState.paused,
        pausedReason: guardState.reason,
        lastSelectorMiss: guardState.lastSelectorMiss,
        bridgeOk: snap !== null,
        updatedAt: Date.now(),
    };

    publishAutopilotStatus(ns, status);
}

function render(
    ns: NS,
    config: WacnOSConfig,
    decision: { phase: Phase; step: string; note: string },
    snap: GameSnapshot | null,
    sharing: boolean,
): void {
    const player = ns.getPlayer();
    const reset = ns.getResetInfo();
    const daedalus = snap?.factions["Daedalus"];

    ns.clearLog();
    ns.print(`WacnOS Autopilot   [${decision.phase}]  ${decision.step}`);
    ns.print(`  ${decision.note}`);
    ns.print("");
    ns.print(`  bitnode    ${reset.currentNode} -> ${nextBitNode(ns, config)}   route ${routeLabel(config)}   driver ${config.nextNodeDriver}`);
    ns.print(`  augs       ${snap?.distinctOwned ?? reset.ownedAugs.size} / ${DAEDALUS.augs} installed, ${snap?.queued.length ?? 0} queued`);
    ns.print(`  money      ${ns.format.number(player.money)}   hacking ${player.skills.hacking}`);
    if (daedalus?.joined) {
        ns.print(`  daedalus   ${ns.format.number(daedalus.rep)} / ${ns.format.number(DAEDALUS.redPillRep)} rep`);
    }
    ns.print(`  bridge     ${snap ? "OK" : "DEGRADED"}   sharing ${sharing ? "on" : "off"}`);
    if (guardState.lastSelectorMiss) ns.print(`  last miss  ${guardState.lastSelectorMiss}`);
}
