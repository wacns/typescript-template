import {NS} from "@ns";
import {openAvailablePorts} from "lib/root-access";
import {scanAllServers} from "lib/network-scan";
import {ACTION_SCRIPT} from "Dispatchers/hwgw-batcher";
import {hasSingularityAccess} from "lib/singularity-access";

/** @param {NS} ns */
export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.disableLog("exec");
    ns.clearLog();

    const flags = ns.flags([
        ["no-cloud", false], // disable purchasing & upgrading cloud servers
    ]);
    const cloudBuyingDisabled = flags["no-cloud"] as boolean;

    const PLAIN_PAYLOAD = "HackRelated/worker.js";
    const FORMULA_PAYLOAD = "HackRelated/formula-worker.js";
    const BATCHER_PAYLOAD = "Dispatchers/hwgw-batcher.js";
    const autoBuyerScript = "Utils/purchase-cloud-servers.js";
    const darkwebScript = "Utils/auto-darkweb.js";
    let currentTarget = "n00dles";
    let currentPayload = PLAIN_PAYLOAD;

    const hasSingularity = hasSingularityAccess(ns);

    // --- SERVER MEMORY STATE ---
    const cloudMemory = new Map<string, number>();
    let sessionBought = 0;
    let sessionUpgraded = 0;

    const initialServers = ns.cloud.getServerNames();
    for (const srv of initialServers) {
        cloudMemory.set(srv, ns.getServerMaxRam(srv));
    }

    // --- FINANCIAL TELEMETRY STATE ---
    const startTime = Date.now();
    const startMoney = ns.getServerMoneyAvailable("home");

    ns.tprint(`[START] V2.7.1 Botnet Commander Online. (Singularity Access: ${hasSingularity}, Cloud Buying: ${cloudBuyingDisabled ? "Disabled" : "Enabled"})`);

    while (true) {
        // --- 0. HARDWARE & SOFTWARE PROVISIONING ---
        if (!cloudBuyingDisabled && ns.fileExists(autoBuyerScript, "home")) {
            ns.exec(autoBuyerScript, "home", 1, -1);
        }

        // Only attempt to launch the Darkweb script if we passed the Singularity check!
        if (hasSingularity) {
            if (ns.fileExists(darkwebScript, "home") && !ns.isRunning(darkwebScript, "home")) {
                ns.exec(darkwebScript, "home", 1);
            }
        }

        await ns.sleep(1000);

        // --- HARDWARE CHANGES CHECK ---
        const currentPurchased = ns.cloud.getServerNames();
        for (const srv of currentPurchased) {
            const currentRam = ns.getServerMaxRam(srv);

            if (!cloudMemory.has(srv)) {
                sessionBought++;
                cloudMemory.set(srv, currentRam);
            } else if (cloudMemory.get(srv)! < currentRam) {
                sessionUpgraded++;
                cloudMemory.set(srv, currentRam);
            }
        }

        // 1. Map the entire network
        const knownServers = scanAllServers(ns);

        // 2. Auto-Cracker
        let rootedCount = 0;
        for (const server of knownServers) {
            if (!ns.hasRootAccess(server)) {
                const portsOpened = openAvailablePorts(ns, server);

                if (ns.getServerNumPortsRequired(server) <= portsOpened) {
                    ns.nuke(server);
                    ns.tprint(`[SYSTEM BREACH] Auto-Nuked new server: ${server}`);
                }
            }
            if (ns.hasRootAccess(server)) rootedCount++;
        }

        // 3. True Profit Evaluator
        let bestTarget = "n00dles";
        let bestScore = 0;
        const myHackLevel = ns.getHackingLevel();

        for (const server of knownServers) {
            if (ns.hasRootAccess(server) && ns.getServerMaxMoney(server) > 0) {
                if (ns.getServerRequiredHackingLevel(server) <= myHackLevel) {
                    const weakenTime = ns.getWeakenTime(server);
                    const hackChance = ns.hackAnalyzeChance(server);
                    const score = (ns.getServerMaxMoney(server) * hackChance) / weakenTime;

                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = server;
                    }
                }
            }
        }

        // 4. Handle Target Switching
        let targetChanged = false;
        if (bestTarget !== currentTarget) {
            ns.tprint(`[TACTICAL SHIFT] Redirecting entire botnet to: ${bestTarget}`);
            currentTarget = bestTarget;
            targetChanged = true;
        }

        // Pick the payload tier based on live Formulas.exe availability and how close the target is to
        // "prepped" (security at floor, money at cap) - hwgw-batcher.ts assumes that starting state, so
        // formula-worker.ts (or worker.ts, with no Formulas.exe) handles getting it there first. Checking
        // this live every cycle means gaining/losing Formulas.exe or a target drifting out of prep (e.g.
        // an outside actor also hacking it) is picked up automatically without anything crashing.
        const hasFormulas = ns.fileExists("Formulas.exe", "home");
        const securityMargin = ns.getServerSecurityLevel(currentTarget) - ns.getServerMinSecurityLevel(currentTarget);
        const moneyRatio = ns.getServerMaxMoney(currentTarget) > 0
            ? ns.getServerMoneyAvailable(currentTarget) / ns.getServerMaxMoney(currentTarget)
            : 1;
        const isPrepped = securityMargin <= 1 && moneyRatio >= 0.99;

        let payload: string;
        if (hasFormulas && isPrepped) {
            payload = BATCHER_PAYLOAD;
        } else if (hasFormulas) {
            payload = FORMULA_PAYLOAD;
        } else {
            payload = PLAIN_PAYLOAD;
        }
        const payloadChanged = payload !== currentPayload;
        const previousPayload = currentPayload;
        currentPayload = payload;

        if (payloadChanged) {
            for (const server of knownServers) {
                if (ns.hasRootAccess(server)) {
                    ns.scriptKill(previousPayload, server);
                }
            }
        }

        // 5. Continuous Deployment & RAM Scavenging
        let totalThreads = 0;
        let deployedServers = 0;

        if (payload === BATCHER_PAYLOAD) {
            // Single coordinator model: hwgw-batcher.js manages its own thread allocation across the
            // whole network, so there's just one coordinator instance to keep running for the target.
            if (targetChanged) {
                ns.scriptKill(BATCHER_PAYLOAD, "home");
            }
            if (ns.fileExists(BATCHER_PAYLOAD, "home") && !ns.isRunning(BATCHER_PAYLOAD, "home", currentTarget)) {
                ns.exec(BATCHER_PAYLOAD, "home", 1, currentTarget);
            }

            // The coordinator itself only ever runs on home - the actual hack/grow/weaken bursts it
            // schedules land on whatever servers allocateThreads() picked, and each burst is a brief
            // one-shot process, so tallying them here (rather than just checking the coordinator) is
            // what makes the dashboard's drone/thread counts reflect real batcher activity.
            for (const server of knownServers) {
                if (!ns.hasRootAccess(server)) continue;

                const actionProcesses = ns.ps(server).filter(p => p.filename === ACTION_SCRIPT && p.args[0] === currentTarget);
                if (actionProcesses.length > 0) {
                    deployedServers++;
                    totalThreads += actionProcesses.reduce((sum, p) => sum + p.threads, 0);
                }
            }
        } else {
            const scriptRam = ns.getScriptRam(payload, "home");

            for (const server of knownServers) {
                if (!ns.hasRootAccess(server)) continue;

                if (server !== "home") {
                    await ns.scp(payload, server, "home");
                }

                if (targetChanged) {
                    ns.scriptKill(payload, server);
                }

                const maxRam = ns.getServerMaxRam(server);
                const usedRam = ns.getServerUsedRam(server);
                let availableRam = maxRam - usedRam;

                if (server === "home") {
                    const reserve = Math.max(32, maxRam * 0.10);
                    availableRam -= reserve;
                }

                const threads = Math.floor(availableRam / scriptRam);

                if (threads > 0) {
                    ns.exec(payload, server, threads, currentTarget);
                }

                // Counted from the processes themselves rather than the host's used RAM: that RAM
                // includes this dispatcher and every unrelated script on the box, which on home in
                // particular inflated the tally and kept the drone count from ever reaching 0.
                const workerProcesses = ns.ps(server).filter(p => p.filename === payload && p.args[0] === currentTarget);
                if (workerProcesses.length > 0) {
                    deployedServers++;
                    totalThreads += workerProcesses.reduce((sum, p) => sum + p.threads, 0);
                }
            }
        }

        // --- LIVE DASHBOARD (The 60-Second Redraw Loop) ---
        const cycleTimeMs = ns.getWeakenTime(currentTarget);
        const formattedCycleTime = ns.format.time(cycleTimeMs);
        const serverLimit = ns.cloud.getServerLimit();

        for (let secondsLeft = 59; secondsLeft > 0; secondsLeft--) {
            const currentMoney = ns.getServerMoneyAvailable("home");
            const sessionProfit = currentMoney - startMoney;
            const uptimeSeconds = Math.max(1, (Date.now() - startTime) / 1000);
            const incomePerSec = sessionProfit / uptimeSeconds;

            const isDarkwebRunning = ns.isRunning(darkwebScript, "home");

            ns.clearLog();
            ns.print("=========================================");
            ns.print("🛡️ BOTNET COMMANDER V2.7 🛡️");
            ns.print("=========================================");
            ns.print(`🎯 Current Target : ${currentTarget}`);
            const payloadLabel = currentPayload === BATCHER_PAYLOAD ? "hwgw-batcher (prepped)"
                : currentPayload === FORMULA_PAYLOAD ? "formula-worker (prepping)"
                    : "worker (heuristic)";
            ns.print(`🧮 Payload        : ${payloadLabel}`);
            ns.print(`⏳ Hack Cycle     : ${formattedCycleTime}`);
            ns.print(`🖥️ Rooted Servers : ${rootedCount} / ${knownServers.length}`);
            ns.print(`🤖 Active Drones  : ${deployedServers} servers`);
            ns.print(`🔥 Total Threads  : ${totalThreads} attacking`);
            ns.print("-----------------------------------------");
            ns.print(`☁️ Cloud Servers  : ${currentPurchased.length} / ${serverLimit} Owned${cloudBuyingDisabled ? " (buying disabled)" : ""}`);
            ns.print(`🛒 Session Bought : ${sessionBought}`);
            ns.print(`⬆️ Session Upgrade: ${sessionUpgraded}`);

            // The dashboard now dynamically updates its text based on your access!
            if (hasSingularity) {
                ns.print(`🌐 Darkweb Daemon : ${isDarkwebRunning ? "Active" : "Idle"}`);
            } else {
                ns.print(`🌐 Darkweb Daemon : Locked (Requires SF-4)`);
            }

            ns.print("-----------------------------------------");
            ns.print(`💰 Session Profit : $${ns.format.number(sessionProfit)}`);
            ns.print(`📈 Income Rate    : $${ns.format.number(incomePerSec)} / sec`);

            const dots = ".".repeat((59 - secondsLeft) % 4);
            ns.print(`⏱️ Next scan in   : ${secondsLeft}s ${dots}`);
            ns.print("=========================================");

            await ns.sleep(1000);
        }
    }
}