import {NS, Server} from "@ns";
import {WacnPorts} from "WacnOS/ports";
import {dodge} from "WacnOS/rpc/dodge";
import {HackTiming} from "WacnOS/helpers/getHackTiming";
import {publishHackLoopStatus} from "WacnOS/status";

const PAYLOAD_SCRIPT = "WacnOS/launcher/payload.js";
const GET_SERVER = "WacnOS/helpers/getServer.js";
const GET_ALL_SERVERS = "WacnOS/helpers/getAllServers.js";
const GET_SERVER_AVAIL_RAM = "WacnOS/helpers/getServerAvailRam.js";
const GET_GROW_THREADS = "WacnOS/helpers/getGrowThreads.js";
const GET_HACK_TIMING = "WacnOS/helpers/getHackTiming.js";
const GET_OPTIMAL_TARGET = "WacnOS/helpers/getOptimalTarget.js";
const ROOT_NEW_SERVERS = "WacnOS/helpers/rootNewServers.js";
const PURCHASE_SERVERS = "WacnOS/helpers/purchaseServers.js";

const SPACING_MS = 200;
const HACK_FRACTION = 0.25; // steal ~25% of max money per batch - conservative, keeps thread counts modest

interface ServerBudget {
    hostname: string;
    threads: number;
}

/**
 * WacnOS's hacking-loop bot - a fresh TS port of SphyxOS's puppetMini.js approach (target
 * selection, prep-then-batch HWGW cycling, thread allocation across every rooted server), using
 * WacnOS's own RAM-dodging RPC layer (rpc/dodge.ts + helpers/*.ts) to keep this script's own
 * static RAM cost minimal - everything expensive (ns.formulas.*, ns.getServer, ns.cloud.*) lives
 * only in disposable, never-imported helper scripts.
 */
export async function main(ns: NS): Promise<void> {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();
    ns.ui.setTailTitle("WacnOS - Hacking Loop");
    ns.ui.resizeTail(560, 260);

    ns.clearPort(WacnPorts.HACKLOOP_PID);
    ns.writePort(WacnPorts.HACKLOOP_PID, ns.pid);
    ns.atExit(() => ns.clearPort(WacnPorts.HACKLOOP_PID));

    const payloadRam = ns.getScriptRam(PAYLOAD_SCRIPT);
    let moneyMode = !ns.args.includes("noxponly");
    let purchaseMode = ns.args.includes("purchase");
    let target = (ns.args[0] as string) || "";

    while (true) {
        drainCommands(ns, (cmd) => {
            if (cmd === "money") moneyMode = true;
            else if (cmd === "noxponly") moneyMode = true;
            else if (cmd === "xponly") moneyMode = false;
            else if (cmd === "purchase") purchaseMode = true;
            else if (cmd === "nopurchase") purchaseMode = false;
            else if (cmd === "target") target = ""; // force a re-pick next cycle
        });

        await dodge(ns, ROOT_NEW_SERVERS);

        if (!target) {
            target = (await dodge(ns, GET_OPTIMAL_TARGET) as string) || "n00dles";
        }

        const server = await dodge(ns, GET_SERVER, [target]) as Server;
        const budgets = await getBudgets(ns, payloadRam);
        const totalThreads = budgets.reduce((sum, b) => sum + b.threads, 0);

        const minSecurity = server.minDifficulty ?? 1;
        const curSecurity = server.hackDifficulty ?? minSecurity;
        const maxMoney = server.moneyMax ?? 0;
        const curMoney = server.moneyAvailable ?? 0;
        const weakenPerThread = ns.weakenAnalyze(1);

        let waitMs = 2000;
        let phaseLabel = "IDLE";

        if (totalThreads === 0) {
            phaseLabel = "WAITING FOR RAM";
        } else if (!moneyMode) {
            // XP-only mode: just weaken forever, cheap and always safe regardless of prep state.
            dispatch(ns, budgets, target, "weaken", totalThreads, 0);
            waitMs = ns.getWeakenTime(target) + SPACING_MS;
            phaseLabel = `XP (${totalThreads} weaken threads)`;
        } else if (curSecurity > minSecurity + 0.5) {
            const needed = Math.max(1, Math.ceil((curSecurity - minSecurity) / weakenPerThread));
            const threads = Math.min(needed, totalThreads);
            dispatch(ns, budgets, target, "weaken", threads, 0);
            waitMs = ns.getWeakenTime(target) + SPACING_MS;
            phaseLabel = `PREP WEAKEN (${threads})`;
        } else if (maxMoney > 0 && curMoney < maxMoney * 0.99) {
            const growThreads = Math.max(1, await dodge(ns, GET_GROW_THREADS, [target]) as number);
            const growSecurity = ns.growthAnalyzeSecurity(growThreads, target);
            const weakenThreads = Math.min(totalThreads, Math.max(1, Math.ceil(growSecurity / weakenPerThread)));
            const affordGrow = Math.min(growThreads, Math.max(0, totalThreads - weakenThreads));
            if (weakenThreads > 0) dispatch(ns, budgets, target, "weaken", weakenThreads, 0);
            if (affordGrow > 0) dispatch(ns, budgets, target, "grow", affordGrow, 0);
            waitMs = Math.max(ns.getWeakenTime(target), ns.getGrowTime(target)) + SPACING_MS;
            phaseLabel = `PREP GROW (${affordGrow}g / ${weakenThreads}w)`;
        } else {
            const timing = await dodge(ns, GET_HACK_TIMING, [target]) as HackTiming;
            const hackPercent = Math.max(0.0001, timing.hackPercent);
            const rawHack = Math.max(1, Math.floor(HACK_FRACTION / hackPercent));
            const rawHackSecurity = ns.hackAnalyzeSecurity(rawHack, target);
            const rawWeaken1 = Math.max(1, Math.ceil(rawHackSecurity / weakenPerThread));
            const rawGrow = Math.max(1, await dodge(ns, GET_GROW_THREADS, [target]) as number);
            const rawGrowSecurity = ns.growthAnalyzeSecurity(rawGrow, target);
            const rawWeaken2 = Math.max(1, Math.ceil(rawGrowSecurity / weakenPerThread));

            // Weakens matter most (keep the target prepped for next cycle), then grow, then hack.
            const [weaken1, weaken2, grow, hack] = capToBudget([rawWeaken1, rawWeaken2, rawGrow, rawHack], totalThreads);

            const T0 = Math.max(
                timing.hackTime,
                timing.weakenTime - SPACING_MS,
                timing.growTime - 2 * SPACING_MS,
                timing.weakenTime - 3 * SPACING_MS,
            );

            if (hack > 0) dispatch(ns, budgets, target, "hack", hack, T0 - timing.hackTime);
            if (weaken1 > 0) dispatch(ns, budgets, target, "weaken", weaken1, T0 + SPACING_MS - timing.weakenTime);
            if (grow > 0) dispatch(ns, budgets, target, "grow", grow, T0 + 2 * SPACING_MS - timing.growTime);
            if (weaken2 > 0) dispatch(ns, budgets, target, "weaken", weaken2, T0 + 3 * SPACING_MS - timing.weakenTime);

            waitMs = T0 + 4 * SPACING_MS + SPACING_MS;
            phaseLabel = `BATCH (h${hack} w${weaken1} g${grow} w${weaken2})`;
        }

        if (purchaseMode) await dodge(ns, PURCHASE_SERVERS);

        ns.clearLog();
        ns.print(`Target: ${target}`);
        ns.print(`Security: ${curSecurity.toFixed(2)} / min ${minSecurity.toFixed(2)}`);
        ns.print(`Money: ${ns.format.number(curMoney)} / ${ns.format.number(maxMoney)}`);
        ns.print(`Threads available: ${totalThreads}${moneyMode ? "" : " (XP-only mode)"}`);
        ns.print(`Phase: ${phaseLabel}`);
        ns.ui.renderTail();

        publishHackLoopStatus(ns, {
            target,
            phase: phaseLabel,
            securityCur: curSecurity,
            securityMin: minSecurity,
            moneyCur: curMoney,
            moneyMax: maxMoney,
            threads: totalThreads,
            moneyMode,
            purchaseMode,
            updatedAt: Date.now(),
        });

        await ns.asleep(Math.max(200, waitMs));
    }
}

function drainCommands(ns: NS, onCommand: (cmd: string) => void): void {
    while (ns.peek(WacnPorts.HACKLOOP_CMD) !== "NULL PORT DATA") {
        onCommand(String(ns.readPort(WacnPorts.HACKLOOP_CMD)));
    }
}

async function getBudgets(ns: NS, payloadRam: number): Promise<ServerBudget[]> {
    const servers = await dodge(ns, GET_ALL_SERVERS) as Server[];
    const budgets: ServerBudget[] = [];
    for (const server of servers) {
        if (!server.hasAdminRights || !server.maxRam) continue;
        const freeRam = await dodge(ns, GET_SERVER_AVAIL_RAM, [server.hostname]) as number;
        const threads = Math.floor(freeRam / payloadRam);
        if (threads > 0) budgets.push({hostname: server.hostname, threads});
    }
    return budgets;
}

function dispatch(ns: NS, budgets: ServerBudget[], target: string, action: string, threads: number, delayMs: number): void {
    let remaining = threads;
    for (const budget of budgets) {
        if (remaining <= 0) break;
        if (budget.threads <= 0) continue;
        const chunk = Math.min(budget.threads, remaining);
        const pid = ns.exec(PAYLOAD_SCRIPT, budget.hostname, {threads: chunk, temporary: true}, target, action, Math.max(0, delayMs));
        if (pid > 0) {
            budget.threads -= chunk;
            remaining -= chunk;
        }
    }
}

/** Allocates `budget` threads across `requested` counts, in priority order (earlier entries get filled first). */
function capToBudget(requested: number[], budget: number): number[] {
    let remaining = budget;
    return requested.map((count) => {
        const used = Math.min(count, Math.max(0, remaining));
        remaining -= used;
        return used;
    });
}
