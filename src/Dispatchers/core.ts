import { NS } from "@ns";
import { tryPasswords } from "lib/dnet-auth";

const LOG_PORT = 19;
const scriptName = "Dispatchers/core.js";
const scriptAuthName = "lib/dnet-auth.js";

async function lightweightAuthenticate(ns: NS, neighbor: string, sendLog: (msg: string) => void) {
    const details = ns.dnet.getServerDetails(neighbor);
    if (!details.isConnectedToCurrentServer || !details.isOnline || details.hasSession) {
        return details.hasSession;
    }

    sendLog(`[PROBE] Target: ${neighbor} | Model: ${details.modelId} | Hint: "${details.passwordHint}"`);

    let passwordsToTry: string[] = [];

    if (details.modelId === "ZeroLogon") {
        passwordsToTry = [""];
    }
    else if (details.modelId === "FreshInstall_1.0" || details.modelId === "byte.genesis") {
        const hintLower = details.passwordHint.toLowerCase();
        passwordsToTry = [
            hintLower.includes("factory") ? "factory" : "",
            hintLower.includes("settings") ? "settings" : "",
            hintLower.includes("default") ? "default" : "",
            "password", "default", "factory", "settings", "admin", "root", "12345", "0000"
        ].filter(Boolean);
    }
    else if (details.modelId === "DeskMemo_3.1" || details.modelId === "PHP 5.4") {
        const m = details.passwordHint.match(/(?:key is|secret is|PIN is|use|shuffled)\s*([0-9]+)/i);
        passwordsToTry = [m ? m[1] : details.passwordHint.replace(/[^0-9]/g, "")];
    }
    else if (details.modelId === "CloudBlare(tm)") {
        passwordsToTry = [details.data ? details.data.replace(/[^0-9]/g, "") : ""];
    }
    else if (details.modelId === "OctantVoxel") {
        // details.data is "base,encodedValue" (e.g. "2,11001110"); the password is that value read in base 10.
        const [baseStr, encoded] = (details.data ?? "").split(",");
        const base = Math.trunc(Number(baseStr));
        if (encoded && base >= 2 && base <= 36) {
            const decoded = parseInt(encoded, base);
            if (!isNaN(decoded)) {
                passwordsToTry = [decoded.toString()];
            }
        }
    }
    else {
        const numMatch = details.passwordHint.match(/([0-9]+)/);
        passwordsToTry = numMatch ? [numMatch[1], "password"] : ["password", "default", "admin"];
    }

    const uniquePasswords = Array.from(new Set(passwordsToTry));

    const winner = await tryPasswords(ns, neighbor, uniquePasswords);
    if (winner !== null) {
        sendLog(`[SUCCESS] Authenticated ${neighbor} with password: "${winner}"`);
        return true;
    }

    sendLog(`[FAIL] All authentication vectors exhausted on ${neighbor}`);
    return false;
}

// Unified deployment logic for both home and remote nodes
async function handleNode(ns: NS, neighbor: string, home: string, sendLog: (msg: string) => void) {
    if (neighbor === home) return;

    const authenticated = await lightweightAuthenticate(ns, neighbor, sendLog);
    if (authenticated) {
        if (ns.scp(scriptName, neighbor, home) && ns.scp(scriptAuthName, neighbor, home)) {
            const scriptRam = ns.getScriptRam(scriptName, neighbor);
            const availableRam = ns.getServerMaxRam(neighbor) - ns.getServerUsedRam(neighbor);

            if (availableRam >= scriptRam && !ns.isRunning(scriptName, neighbor)) {
                const pid = ns.exec(scriptName, neighbor, 1);
                if (pid > 0) {
                    sendLog(`[SUCCESS] Deployed core to ${neighbor} (PID: ${pid})`);
                }
            }
        }
    }
}

export async function main(ns: NS): Promise<void> {
    const currentNode = ns.getHostname();
    const home = "home";

    ns.disableLog("sleep");
    ns.disableLog("scp");
    ns.disableLog("exec");
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getServerUsedRam");
    ns.disableLog("getScriptRam");
    ns.disableLog("clearPort");
    ns.disableLog("ls");

    const sendLog = (message: string) => {
        const formatted = `[${currentNode}] ${message}`;
        if (currentNode === home) {
            ns.tprint(formatted);
        } else {
            ns.tryWritePort(LOG_PORT, formatted);
        }
    };

    // Open local cache files if any exist
    const files = ns.ls(currentNode);
    for (const file of files.filter(f => f.endsWith(".cache"))) {
        ns.dnet.openCache(file);
        sendLog(`[SUCCESS] Opened cache: ${file}`);
    }

    if (currentNode === home) {
        ns.ui.openTail();
        ns.clearPort(LOG_PORT);
        sendLog("Bootstrapping core lightweight worm network...");

        while (true) {
            const neighbors: string[] = ns.dnet.probe();
            for (const neighbor of neighbors) {
                await handleNode(ns, neighbor, home, sendLog);
            }

            const portHandle = ns.getPortHandle(LOG_PORT);
            while (!portHandle.empty()) {
                const logMsg = portHandle.read();
                if (logMsg && logMsg !== "NULL PORT DATA") {
                    ns.tprint(logMsg);
                }
            }

            await ns.sleep(10000);
        }
    } else {
        if (ns.getServerMaxRam(currentNode) >= 32 && !ns.fileExists("Workers/heavy-worker.js", currentNode)) {
            ns.scp("Workers/heavy-worker.js", currentNode, home);
            ns.exec("Workers/heavy-worker.js", currentNode, 1);
        }

        while (true) {
            const neighbors: string[] = ns.dnet.probe();
            for (const neighbor of neighbors) {
                await handleNode(ns, neighbor, home, sendLog);
            }
            await ns.sleep(10000);
        }
    }
}