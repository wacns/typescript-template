import { NS } from "@ns";
import { openAvailablePorts } from "lib/root-access";

/** @param {NS} ns */
export async function main(ns: NS) {
    ns.disableLog("ALL");
    ns.disableLog("exec");
    ns.clearLog();

    const flags = ns.flags([
        ["no-cloud", false], // disable purchasing & upgrading cloud servers
    ]);
    const cloudBuyingDisabled = flags["no-cloud"] as boolean;

    const payload = "HackRelated/worker.js";
    const autoBuyerScript = "Utils/purchase-cloud-servers.js";
    const darkwebScript = "Utils/auto-darkweb.js";
    let currentTarget = "n00dles";

    // --- NEW: DYNAMIC SINGULARITY CHECK ---
    // Check if the player has the ability to run darkweb scripts
    let hasSingularity = false;
    try {
        const ownedSF = ns.singularity.getOwnedSourceFiles();
        hasSingularity = ownedSF.some(sf => sf.n === 4);

        // If they are currently inside BitNode-4, they also get free access
        if (!hasSingularity && ns.getResetInfo().currentNode === 4) {
            hasSingularity = true;
        }
    } catch (e) {
        ns.tprint(`[WARNING] Could not determine Singularity access. Defaulting to no access. Error: ${e}`);
        // Failsafe in case of API issues
        hasSingularity = false;
    }

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
        const serversToScan = ["home"];
        const knownServers = new Set(["home"]);

        for (let i = 0; i < serversToScan.length; i++) {
            const currentServer = serversToScan[i];
            for (const nextServer of ns.scan(currentServer)) {
                if (!knownServers.has(nextServer)) {
                    knownServers.add(nextServer);
                    serversToScan.push(nextServer);
                }
            }
        }

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
                if (ns.getServerRequiredHackingLevel(server) <= (myHackLevel / 2)) {
                    const weakenTime = ns.getWeakenTime(server);
                    const score = ns.getServerMaxMoney(server) / (ns.getServerMinSecurityLevel(server) * weakenTime);

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

        // 5. Continuous Deployment & RAM Scavenging
        let totalThreads = 0;
        let deployedServers = 0;
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

            const activeWorkers = Math.floor(ns.getServerUsedRam(server) / scriptRam);
            if (activeWorkers > 0) {
                totalThreads += activeWorkers;
                deployedServers++;
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
            ns.print(`⏳ Hack Cycle     : ${formattedCycleTime}`);
            ns.print(`🖥️ Rooted Servers : ${rootedCount} / ${knownServers.size}`);
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