import { NS } from "@ns";

const LOG_PORT = 19;
const successServers: string[] = [];

const staticPasswordCache: { [modelId: string]: string } = {
    "ZeroLogon": "",
    "FreshInstall_1.0": "password",
    "byte.genesis": "0000",
    "Laika4": "laika",
    "omnit3k_incorporat3d": "506",
    "NIL": "nil"
};

// Roman numeral translation helper for BellaCuore
function romanToInt(s: string): number {
    const map: { [key: string]: number } = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let result = 0;
    for (let i = 0; i < s.length; i++) {
        const current = map[s[i].toUpperCase()];
        const next = map[s[i + 1]?.toUpperCase()];
        if (next && current < next) {
            result -= current;
        } else {
            result += current;
        }
    }
    return result;
}

async function authenticateAndInfect(ns: NS, neighbor: string, scriptName: string, home: string, sendLog: (msg: string) => void) {
    try {
        const details = ns.dnet.getServerDetails(neighbor);
        if (!details.isConnectedToCurrentServer || !details.isOnline) {
            return;
        }

        let passwordToTry = "";
        let alreadyAuthenticated = details.hasSession;

        if (!alreadyAuthenticated) {
            sendLog(`[PROBE] Target: ${neighbor} | Model: ${details.modelId} | Hint: "${details.passwordHint}" | Data: "${details.data}"`);

            if (details.modelId === "ZeroLogon") {
                passwordToTry = "";
            }
            else if (staticPasswordCache[details.modelId] !== undefined) {
                passwordToTry = staticPasswordCache[details.modelId];
            }
            else if (details.modelId === "DeskMemo_3.1") {
                const keyMatch = details.passwordHint.match(/key is ([0-9]+)/i);
                passwordToTry = keyMatch ? keyMatch[1] : details.passwordHint.replace(/[^0-9]/g, "");
            }
            else if (details.modelId === "PHP 5.4") {
                const rawDigits = details.data ? details.data.toString() : details.passwordHint.replace(/[^0-9]/g, "");
                const pinCandidates = [rawDigits, `0${rawDigits}`, `${rawDigits}0`, rawDigits.split("").reverse().join("")];
                for (const pin of pinCandidates) {
                    if (!pin) continue;
                    const res = await ns.dnet.authenticate(neighbor, pin);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = pin;
                        sendLog(`[SUCCESS] Cracked PHP 5.4 on ${neighbor} with PIN: "${pin}"`);
                        break;
                    }
                }
                passwordToTry = rawDigits;
            }
            else if (details.modelId === "CloudBlare(tm)") {
                passwordToTry = details.data ? details.data.replace(/[^0-9]/g, "") : "";
            }
            else if (details.modelId === "FreshInstall_1.0" || details.modelId === "byte.genesis") {
                const hintLower = details.passwordHint.toLowerCase();
                const hintWords = details.passwordHint.match(/\b[a-zA-Z0-9]+\b/g) || [];
                const defaultCandidates = [
                    ...hintWords,
                    hintWords.join(""),
                    hintWords.reverse().join(""),
                    hintLower.includes("factory") ? "factory" : "",
                    hintLower.includes("settings") ? "settings" : "",
                    hintLower.includes("default") ? "default" : "",
                    hintLower.includes("never") ? "neverchanged" : "",
                    "default", "password", "admin", "root", "12345", "0000",
                    "welcome", "guest", "changeme", "neverchanged"
                ].filter(Boolean);

                const uniqueCandidates = Array.from(new Set(defaultCandidates));

                for (const dc of uniqueCandidates) {
                    const res = await ns.dnet.authenticate(neighbor, dc);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = dc;
                        staticPasswordCache[details.modelId] = dc;
                        sendLog(`[SUCCESS] Authenticated ${neighbor} with candidate: "${dc}"`);
                        break;
                    }
                }
                if (!alreadyAuthenticated) passwordToTry = uniqueCandidates[0];
            }
            else if (details.modelId === "Laika4") {
                const candidates = ["laika", "Laika", "LAIKA", "dog", "puppy"];
                for (const c of candidates) {
                    const res = await ns.dnet.authenticate(neighbor, c);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = c;
                        staticPasswordCache[details.modelId] = c;
                        sendLog(`[SUCCESS] Authenticated ${neighbor} using candidate: "${c}"`);
                        break;
                    }
                }
            }
            else if (details.modelId === "OpenWebAccessPoint") {
                const candidatePool = [
                    details.data ? details.data.toString() : "",
                    details.passwordHint,
                    "mustang", "cafe", "social", "media", "syscore"
                ];
                for (const candidate of candidatePool) {
                    if (!candidate) continue;
                    const res = await ns.dnet.authenticate(neighbor, candidate);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = candidate;
                        sendLog(`[SUCCESS] Authenticated ${neighbor} using pool candidate: "${candidate}"`);
                        break;
                    }
                }
                passwordToTry = details.data ? details.data.toString() : details.passwordHint;
            }
            else if (details.modelId === "BellaCuore") {
                const romanMatch = details.passwordHint.match(/\b([IVXLCDMivxlcdm]+)\b/);
                if (romanMatch) {
                    const val = romanToInt(romanMatch[1]);
                    passwordToTry = val.toString();
                    sendLog(`[SOLVER] Extracted Roman numeral "${romanMatch[1]}" -> ${passwordToTry} for ${neighbor}`);
                } else {
                    passwordToTry = details.data ? details.data.toString() : details.passwordHint.replace(/[^0-9]/g, "");
                }
            }
            else if (details.modelId === "Pr0verFl0") {
                const match = details.passwordHint.match(/([0-9]+)\s*bytes/i);
                passwordToTry = match ? match[1] : (details.data ? details.data.toString() : details.passwordHint.replace(/[^0-9]/g, ""));
            }
            else if (details.modelId === "AccountsManager_4.2") {
                const matches = details.passwordHint.match(/between\s+([0-9]+)\s+and\s+([0-9]+)/i);
                const min = matches ? parseInt(matches[1]) : 0;
                const max = matches ? parseInt(matches[2]) : 100;
                for (let i = min; i <= max; i++) {
                    const res = await ns.dnet.authenticate(neighbor, i.toString());
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = i.toString();
                        sendLog(`[SUCCESS] Cracked AccountsManager on ${neighbor} with value: ${i}`);
                        break;
                    }
                }
            }
            else if (details.modelId === "OctantVoxel") {
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
            }
            else if (details.modelId === "Factori-Os") {
                const match = details.passwordHint.match(/divisible by\s+([0-9]+)/i);
                const baseFactor = match ? parseInt(match[1]) : 1;
                for (let i = 1; i <= 1000; i++) {
                    const candidate = (baseFactor * i).toString();
                    const res = await ns.dnet.authenticate(neighbor, candidate);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = candidate;
                        sendLog(`[SUCCESS] Cracked Factori-Os on ${neighbor} with multiplier: ${candidate}`);
                        break;
                    }
                }
            }
            else if (details.modelId === "NIL") {
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
            }
            else if (details.modelId === "DeepGreen") {
                // Brute-force common 4-digit or short combinations for Mastermind model
                for (let i = 0; i < 10000; i++) {
                    const candidate = i.toString().padStart(4, "0");
                    const res = await ns.dnet.authenticate(neighbor, candidate);
                    if (res.success) {
                        alreadyAuthenticated = true;
                        passwordToTry = candidate;
                        sendLog(`[SUCCESS] Cracked DeepGreen on ${neighbor} with code: ${candidate}`);
                        break;
                    }
                }
                passwordToTry = "0000";
            }
            else {
                passwordToTry = details.passwordHint.trim();
            }

            if (!alreadyAuthenticated) {
                let authResult = await ns.dnet.authenticate(neighbor, passwordToTry);

                if (authResult.success) {
                    alreadyAuthenticated = true;
                    if (staticPasswordCache[details.modelId] === undefined && details.modelId !== "CloudBlare(tm)" && details.modelId !== "DeskMemo_3.1") {
                        staticPasswordCache[details.modelId] = passwordToTry;
                    }
                } else {
                    const leak = await ns.dnet.heartbleed(neighbor, { peek: true });
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
                                    const retryResult = await ns.dnet.authenticate(neighbor, candidate);
                                    if (retryResult.success) {
                                        sendLog(`[SUCCESS] Cracked ${neighbor} using Heartbleed token: "${candidate}"`);
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
                const scriptRam = ns.getScriptRam(scriptName, neighbor);
                const availableRam = ns.getServerMaxRam(neighbor) - ns.getServerUsedRam(neighbor);

                if (ns.isRunning(scriptName, neighbor)) {
                    return;
                }

                if (availableRam >= scriptRam) {
                    const pid = ns.exec(scriptName, neighbor, 1);
                    if (pid > 0 && !successServers.includes(neighbor)) {
                        sendLog(`[SUCCESS] Worm spread to ${neighbor} (PID: ${pid})`);
                        successServers.push(neighbor);
                    }
                }
            }
        }
    } catch (err) {
        sendLog(`[ERROR] Exception on ${neighbor}: ${err}`);
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
    ns.disableLog("getServerMaxRam");
    ns.disableLog("getServerUsedRam");
    ns.disableLog("getScriptRam");

    const sendLog = (message: string) => {
        const formatted = `[${currentNode}] ${message}`;
        if (currentNode === home) {
            ns.tprint(formatted);
        } else {
            ns.tryWritePort(LOG_PORT, formatted);
        }
    };

    if (currentNode === home) {
        ns.ui.openTail();
        ns.clearPort(LOG_PORT);
        sendLog("Bootstrapping fully patched continuous worm network...");

        while (true) {
            const neighbors: string[] = ns.dnet.probe();
            for (const neighbor of neighbors) {
                await authenticateAndInfect(ns, neighbor, scriptName, home, sendLog);
            }

            const portHandle = ns.getPortHandle(LOG_PORT);
            while (!portHandle.empty()) {
                const logMsg = portHandle.read();
                if (logMsg && logMsg !== "NULL PORT DATA") {
                    ns.tprint(logMsg);
                }
            }
            await ns.sleep(5000);
        }
    } else {
        const files = ns.ls(currentNode);
        for (const file of files.filter(f => f.endsWith(".cache"))) {
            ns.dnet.openCache(file);
            sendLog(`[SUCCESS] Opened cache: ${file}`);
        }

        if (ns.getServerMaxRam(currentNode) >= 32 && !ns.fileExists("stasis-worker.js", currentNode)) {
            ns.scp("stasis-worker.js", currentNode, home);
            ns.exec("stasis-worker.js", currentNode, 1);
        }

        while (true) {
            const neighbors: string[] = ns.dnet.probe();
            for (const neighbor of neighbors) {
                if (neighbor === home || ns.isRunning(scriptName, neighbor)) continue;
                await authenticateAndInfect(ns, neighbor, scriptName, home, sendLog);
            }
            await ns.sleep(10000);
        }
    }
}