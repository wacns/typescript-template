import {NS} from "@ns";


/** @param {NS} ns */
export async function main(ns: NS) {
    const targetServer = "home";
    const workerScript = "Workers/share-worker.js";

    // Safety buffer: How much RAM (in GB) to leave untouched on your server
    const ramBuffer = 32;

    // 1. Calculate available RAM
    const maxRam = ns.getServerMaxRam(targetServer);
    const usedRam = ns.getServerUsedRam(targetServer);
    const freeRam = maxRam - usedRam;
    const usableRam = freeRam - ramBuffer;

    if (usableRam < 4) {
        ns.tprint("ERROR: Not enough free RAM to launch workers after buffer.");
        return;
    }

    // 2. Calculate maximum threads
    // ns.getScriptRam() dynamically checks the 4GB cost of the worker
    const costPerThread = ns.getScriptRam(workerScript);
    const maxThreads = Math.floor(usableRam / costPerThread);

    // 3. Launch the worker
    if (maxThreads > 0) {
        ns.tprint(`SUCCESS: Launching ${workerScript} with ${maxThreads} threads.`);
        ns.exec(workerScript, targetServer, maxThreads);
    }
}