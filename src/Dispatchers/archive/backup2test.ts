import {NS} from "@ns";

const LOG_PORT = 19;
const successServers: string[] = [];
const failedServers: string[] = [];

// Persistent cache strictly for genuinely fixed/non-instance models across the network
const staticPasswordCache: { [modelId: string]: string } = {
    "ZeroLogon": "",
    "FreshInstall_1.0": "password",
    "byte.genesis": "0000",
    "Laika4": "laika",
    "omnit3k_incorporat3d": "506",
    "NIL": "nil"
};

/** Unified function to solve, authenticate, and infect a target neighbor */
async function authenticateAndInfect(ns: NS, neighbor: string, scriptName: string, home: string, sendLog: (msg: string) => void) {
    try {
        const details = ns.dnet.getServerDetails(neighbor);
        if (!details.isConnectedToCurrentServer || !details.isOnline) {
            return;
        }

        let passwordToTry = "";
        let alreadyAuthenticated = details.hasSession;

        if (!alreadyAuthenticated) {
            if (details.modelId === "ZeroLogon") {
                passwordToTry = "";
            } else if (staticPasswordCache[details.modelId] !== undefined) {
                passwordToTry = staticPasswordCache[details.modelId];
            } else if (details.modelId === "DeskMemo_3.1") {
                const keyMatch = details.passwordHint.match(/key is ([0-9]+)/i);
                passwordToTry = keyMatch ? keyMatch[1] : details.passwordHint.replace(/[^0-9]/g, "");
            } else if (details.modelId === "PHP 5.4") {
                passwordToTry = details.data ? details.data.toString() : details.passwordHint.replace(/[^0-9]/g, "");
            } else if (details.modelId === "CloudBlare(tm)") {
                passwordToTry = details.data ? details.data.replace(/[^0-9]/g, "") : "";
            } else if (details.modelId === "FreshInstall_1.0" || details.modelId === "byte.genesis") {
                const hintLower = details.passwordHint.toLowerCase();
                const defaultCandidates = [
                    hintLower.includes("factory") ? "factory" : "",
                    hintLower.includes("settings") ? "settings" : "",
                    "default", "password", "admin", "root", "12345", "0000",
                    "welcome", "guest", "changeme"
                ].filter(Boolean);

                for (const dc of defaultCandidates) {
                    const res = await ns.dnet.authenticate(neighbor, dc);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = dc;
                        staticPasswordCache[details.modelId] = dc;
                        break;
                    }
                }
                if (!alreadyAuthenticated) passwordToTry = defaultCandidates[0];
            } else if (details.modelId === "Laika4") {
                const candidates = ["laika", "Laika", "LAIKA", "dog", "puppy"];
                for (const c of candidates) {
                    const res = await ns.dnet.authenticate(neighbor, c);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = c;
                        staticPasswordCache[details.modelId] = c;
                        break;
                    }
                }
            } else if (details.modelId === "OpenWebAccessPoint") {
                const candidatePool = [
                    details.data ? details.data.toString() : "",
                    details.passwordHint,
                    details.passwordHint.replace(/[^a-zA-Z]/g, ""),
                    "cafe", "social", "media"
                ];
                for (const candidate of candidatePool) {
                    if (!candidate) continue;
                    const res = await ns.dnet.authenticate(neighbor, candidate);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = candidate;
                        break;
                    }
                }
                passwordToTry = details.data ? details.data.toString() : details.passwordHint;
            } else if (details.modelId === "Pr0verFl0") {
                const match = details.passwordHint.match(/([0-9]+)\s*bytes/i);
                passwordToTry = match ? match[1] : (details.data ? details.data.toString() : details.passwordHint.replace(/[^0-9]/g, ""));
            } else if (details.modelId === "AccountsManager_4.2") {
                const matches = details.passwordHint.match(/between\s+([0-9]+)\s+and\s+([0-9]+)/i);
                const min = matches ? parseInt(matches[1]) : 0;
                const max = matches ? parseInt(matches[2]) : 100;
                for (let i = min; i <= max; i++) {
                    const res = await ns.dnet.authenticate(neighbor, i.toString());
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = i.toString();
                        break;
                    }
                }
            } else if (details.modelId === "OctantVoxel") {
                if (details.data && details.data.includes(",")) {
                    const parts = details.data.split(",");
                    const radix = parseInt(parts[0].trim());
                    const numStr = parts[1].trim();
                    passwordToTry = parseInt(numStr, radix).toString();
                } else {
                    const baseMatch = details.passwordHint.match(/base\s+([0-9]+)\s+number\s+([0-9a-zA-Z]+)/i);
                    if (baseMatch) {
                        const radix = parseInt(baseMatch[1]);
                        const numStr = baseMatch[2];
                        passwordToTry = parseInt(numStr, radix).toString();
                    } else {
                        passwordToTry = details.data ? details.data.toString() : details.passwordHint.replace(/[^0-9]/g, "");
                    }
                }
            } else if (details.modelId === "Factori-Os") {
                const match = details.passwordHint.match(/divisible by\s+([0-9]+)/i);
                const baseFactor = match ? parseInt(match[1]) : 1;
                for (let i = 1; i <= 1000; i++) {
                    const candidate = (baseFactor * i).toString();
                    const res = await ns.dnet.authenticate(neighbor, candidate);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = candidate;
                        break;
                    }
                }
            } else if (details.modelId === "NIL") {
                const nilCandidates = ["nil", "none", "null", "", "unauthorized"];
                for (const nc of nilCandidates) {
                    const res = await ns.dnet.authenticate(neighbor, nc);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = nc;
                        staticPasswordCache[details.modelId] = nc;
                        break;
                    }
                }
                passwordToTry = "nil";
            } else if (details.modelId === "DeepGreen" || details.modelId === "BellaCuore") {
                passwordToTry = details.data ? details.data.toString() : details.passwordHint.replace(/[^0-9]/g, "");
            } else {
                passwordToTry = details.passwordHint.trim();
            }

            if (!alreadyAuthenticated) {
                if (!successServers.includes(neighbor) && !failedServers.includes(neighbor)) {
                    sendLog(`[+] Authenticating ${details.modelId} on ${neighbor} with guess: "${passwordToTry}"...`);
                }

                let authResult = await ns.dnet.authenticate(neighbor, passwordToTry);

                if (authResult.success) {
                    alreadyAuthenticated = true;
                    if (staticPasswordCache[details.modelId] === undefined && details.modelId !== "CloudBlare(tm)" && details.modelId !== "DeskMemo_3.1") {
                        staticPasswordCache[details.modelId] = passwordToTry;
                        sendLog(`[CACHE] Stored working password for static model: ${details.modelId}`);
                    }
                } else {
                    const leak = await ns.dnet.heartbleed(neighbor, {peek: true});
                    if (leak && leak.logs && leak.logs.length > 0) {
                        for (const logLine of leak.logs) {
                            if (logLine.includes("401") || logLine.includes("passwordAttempted") || logLine.includes("Auth failed")) {
                                continue;
                            }

                            const candidates: string[] = [];
                            const quotedMatches = logLine.match(/["']([^"']+)["']/g);
                            if (quotedMatches) {
                                for (const q of quotedMatches) {
                                    candidates.push(q.replace(/["']/g, ""));
                                }
                            }

                            const wordMatches = logLine.match(/\b[a-zA-Z0-9_\-\.\#\@\!]+\b/g);
                            if (wordMatches) {
                                candidates.push(...wordMatches);
                            }

                            const noiseWords = new Set(["401", "true", "false", "null", "undefined", "dnet", "auth", "failed", "passwordAttempted"]);

                            for (const candidate of candidates) {
                                if (candidate.length <= 32 && candidate !== passwordToTry && !noiseWords.has(candidate.toLowerCase())) {
                                    sendLog(`[HEARTBLEED RETRY] Testing leaked hint/format token "${candidate}" on ${neighbor}...`);
                                    const retryResult = await ns.dnet.authenticate(neighbor, candidate);
                                    if (retryResult.success) {
                                        sendLog(`[SUCCESS] Cracked ${neighbor} using leaked token: ${candidate}`);
                                        alreadyAuthenticated = true;
                                        break;
                                    }
                                }
                            }
                            if (alreadyAuthenticated) break;
                        }
                    }
                }
            }
        }

        const updatedDetails = ns.dnet.getServerDetails(neighbor);
        if (updatedDetails.hasSession) {
            if (ns.scp(scriptName, neighbor, ns.getHostname())) {
                const pid = ns.exec(scriptName, neighbor, 1);
                if (pid > 0 && !successServers.includes(neighbor)) {
                    sendLog(`[SUCCESS] Worm spread to ${neighbor} (PID: ${pid})`);
                    successServers.push(neighbor);
                }
            }
        } else {
            if (!failedServers.includes(neighbor) && !successServers.includes(neighbor)) {
                sendLog(`[FAIL] Auth failed for ${details.modelId} on ${neighbor} | Hint: "${details.passwordHint}" | Data: "${details.data}"`);
                failedServers.push(neighbor);
            }
        }
    } catch (err) {
        sendLog(`[ERROR] Exception while processing ${neighbor}: ${err}`);
    }
}

export async function main(ns: NS): Promise<void> {
    const currentNode = ns.getHostname();
    const scriptName = ns.getScriptName();
    const home = "home";

    ns.disableLog("sleep");
    ns.disableLog("scp");
    ns.disableLog("exec");
    ns.disableLog("clearPort");

    const sendLog = (message: string) => {
        const formatted = `[${currentNode}] ${message}`;
        if (currentNode === home) {
            ns.tprint(formatted);
        } else {
            ns.tryWritePort(LOG_PORT, formatted);
        }
    };

    // Central Collector on Home
    if (currentNode === home) {
        ns.ui.openTail();
        ns.clearPort(LOG_PORT);

        sendLog("Bootstrapping centralized worm network...");

        const neighbors: string[] = ns.dnet.probe();
        for (const neighbor of neighbors) {
            await authenticateAndInfect(ns, neighbor, scriptName, home, sendLog);
        }

        ns.print("Central logging active. Listening for remote worm telemetry...");
        while (true) {
            const portHandle = ns.getPortHandle(LOG_PORT);
            while (!portHandle.empty()) {
                const logMsg = portHandle.read();
                if (logMsg && logMsg !== "NULL PORT DATA") {
                    ns.tprint(logMsg);
                }
            }
            await ns.sleep(2000);
        }
    }

    // --- Remote Node Execution ---

    const files = ns.ls(currentNode);
    const cacheFiles = files.filter((file: string) => file.endsWith(".cache"));
    for (const file of cacheFiles) {
        ns.dnet.openCache(file);
        sendLog(`[SUCCESS] Opened cache: ${file} natively!`);
    }

    const neighbors: string[] = ns.dnet.probe();

    for (const neighbor of neighbors) {
        if (neighbor === home || neighbor === "darkweb" || ns.isRunning(scriptName, neighbor)) {
            continue;
        }

        await authenticateAndInfect(ns, neighbor, scriptName, home, sendLog);
    }
}