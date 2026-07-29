import {NS} from "@ns";
import {
    tryPasswords, decodeBaseN, decodeBinaryAscii, decodeXorMask, stripSmallPrimeFactors,
    parseSafeArithmeticExpression, COMMON_PASSWORD_DICTIONARY, EU_COUNTRIES, maxThreadsFor, romanToInt
} from "lib/dnet-auth";

const LOG_PORT = 19;
const scriptName = "Dispatchers/core.js";
const scriptAuthName = "lib/dnet-auth.js";

// PHP 5.4 (SortedEchoVuln) hints show the password's digits sorted, not the password itself; the real
// password is some permutation of those digits. Above this many characters the permutation count explodes.
const MAX_PERMUTATION_LENGTH = 5;

/** All distinct permutations of chars (deduped, since repeated digits produce identical permutations). */
function generatePermutations(chars: string): string[] {
    if (chars.length === 0 || chars.length > MAX_PERMUTATION_LENGTH) return [];

    const results = new Set<string>();
    const used = new Array(chars.length).fill(false);
    const current: string[] = [];

    function backtrack() {
        if (current.length === chars.length) {
            results.add(current.join(""));
            return;
        }
        for (let i = 0; i < chars.length; i++) {
            if (used[i]) continue;
            used[i] = true;
            current.push(chars[i]);
            backtrack();
            current.pop();
            used[i] = false;
        }
    }

    backtrack();

    return Array.from(results);
}

// DeepGreen (MastermindHint) is a real Mastermind game: each failed authenticate() guessStr returns
// "exactCount,misplacedCount" feedback in res.data, scored the same way as classic Mastermind (exact
// position matches, plus correct-but-misplaced characters, both accounting for duplicates). Above this
// length the initial all-numeric candidate pool gets too large to build/filter practically. Its worst
// case (<=20 sequential guesses) is cheaper than AccountsManager_4.2's (<=101), so it's fine everywhere.
const MAX_MASTERMIND_LENGTH = 5;
const MAX_MASTERMIND_GUESSES = 20;

function getExactCorrectCharsCount(password: string, guessStr: string): number {
    let count = 0;
    for (let i = 0; i < password.length; i++) {
        if (password[i] === guessStr[i]) count++;
    }
    return count;
}

function getMisplacedCorrectCharsCount(password: string, guessStr: string): number {
    const remainingPasswordChars = password.split("").filter((c, i) => c !== guessStr[i]);
    const remainingAttemptChars = guessStr.split("").filter((c, i) => c !== password[i]);

    return remainingAttemptChars.filter((c, i) => {
        const isPresentInPassword = remainingPasswordChars.includes(c);
        const countSoFar = remainingAttemptChars.slice(0, i).filter(d => d === c).length;
        const countInPassword = remainingPasswordChars.filter(d => d === c).length;
        return isPresentInPassword && countSoFar < countInPassword;
    }).length;
}

/** Iteratively guesses and filters candidates using live Mastermind feedback until the password is found. */
async function solveMastermind(ns: NS, neighbor: string, length: number): Promise<string | null> {
    let candidates: string[] = [];
    for (let i = 0; i < 10 ** length; i++) {
        candidates.push(i.toString().padStart(length, "0"));
    }

    for (let guess = 0; guess < MAX_MASTERMIND_GUESSES && candidates.length > 0; guess++) {
        const candidate = candidates[0];
        const res = await ns.dnet.authenticate(neighbor, candidate);
        if (res.success) return candidate;

        const [exactStr, misplacedStr] = String(res.data ?? "0,0").split(",");
        const exact = parseInt(exactStr) || 0;
        const misplaced = parseInt(misplacedStr) || 0;

        candidates = candidates.filter(c =>
            c !== candidate &&
            getExactCorrectCharsCount(c, candidate) === exact &&
            getMisplacedCorrectCharsCount(c, candidate) === misplaced
        );
    }
    return null;
}

async function lightweightAuthenticate(ns: NS, neighbor: string, sendLog: (msg: string) => void) {
    const details = ns.dnet.getServerDetails(neighbor);
    if (!details.isConnectedToCurrentServer || !details.isOnline || details.hasSession) {
        return details.hasSession;
    }

    sendLog(`[PROBE] Target: ${neighbor} | Model: ${details.modelId} | Hint: "${details.passwordHint}"`);

    let passwordsToTry: string[] = [];

    if (details.modelId === "ZeroLogon") {
        passwordsToTry = [""];
    } else if (details.modelId === "FreshInstall_1.0" || details.modelId === "byte.genesis") {
        const hintLower = details.passwordHint.toLowerCase();
        passwordsToTry = [
            hintLower.includes("factory") ? "factory" : "",
            hintLower.includes("settings") ? "settings" : "",
            hintLower.includes("default") ? "default" : "",
            "password", "default", "factory", "settings", "admin", "root", "12345", "0000"
        ].filter(Boolean);
    } else if (details.modelId === "DeskMemo_3.1") {
        const m = details.passwordHint.match(/(?:key is|secret is|PIN is|use|shuffled)\s*([0-9]+)/i);
        passwordsToTry = [m ? m[1] : details.passwordHint.replace(/[^0-9]/g, "")];
    } else if (details.modelId === "CloudBlare(tm)") {
        passwordsToTry = [details.data ? details.data.replace(/[^0-9]/g, "") : ""];
    } else if (details.modelId === "Laika4") {
        // Fixed 4-entry dictionary, no hint-derivable info: fido, spot, rover, max.
        passwordsToTry = ["fido", "spot", "rover", "max"];
    } else if (details.modelId === "TopPass") {
        passwordsToTry = COMMON_PASSWORD_DICTIONARY;
    } else if (details.modelId === "EuroZone Free") {
        passwordsToTry = EU_COUNTRIES;
    } else if (details.modelId === "110100100") {
        // details.data is space-separated 8-bit binary ASCII codes, e.g. "01100001 01100010".
        if (details.data) {
            passwordsToTry = [decodeBinaryAscii(details.data)];
        }
    } else if (details.modelId === "OrdoXenos") {
        // details.data is "xorMaskedCiphertext;mask1 mask2 ..." (each mask an 8-bit binary string).
        if (details.data) {
            const decoded = decodeXorMask(details.data);
            if (decoded !== null) {
                passwordsToTry = [decoded];
            }
        }
    } else if (details.modelId === "PrimeTime 2") {
        // details.data is largestPrime * (product of small primes); stripping the small-prime factors leaves the answer.
        if (details.data) {
            passwordsToTry = [stripSmallPrimeFactors(details.data)];
        }
    } else if (details.modelId === "MathML") {
        // details.data is an arithmetic expression (possibly with obfuscated operators and an injected
        // ", ns.exit()" payload); parseSafeArithmeticExpression strips that instead of eval()-ing it directly.
        if (details.data) {
            const result = parseSafeArithmeticExpression(details.data);
            if (!isNaN(result)) {
                passwordsToTry = [result.toString()];
            }
        }
    } else if (details.modelId === "Pr0verFl0") {
        // BufferOverflow: the check compares the guessStr's first half against its second half once the
        // guessStr is >= 2x the password length, not against the real password. Any 2n-length string made
        // of one repeated character trivially satisfies that, so this always succeeds in a single guess.
        if (details.passwordLength > 0) {
            passwordsToTry = ["a".repeat(details.passwordLength * 2)];
        }
    } else if (details.modelId === "AccountsManager_4.2") {
        // Bounded numeric range brute force (e.g. "between 0 and 10"), cheap enough for every node.
        const matches = details.passwordHint.match(/between\s+([0-9]+)\s+and\s+([0-9]+)/i);
        const min = matches ? parseInt(matches[1]) : 0;
        const max = matches ? parseInt(matches[2]) : 100;
        passwordsToTry = Array.from({length: max - min + 1}, (_, i) => (min + i).toString());
    } else if (details.modelId === "BellaCuore") {
        // Deterministic single guess: parse the Roman numeral straight out of the hint text.
        const romanMatch = details.passwordHint.match(/\b([IVXLCDMivxlcdm]+)\b/);
        if (romanMatch) {
            passwordsToTry = [romanToInt(romanMatch[1]).toString()];
        }
    } else if (details.modelId === "PHP 5.4") {
        // SortedEchoVuln: details.data is the password's digits sorted; brute-force its permutations.
        if (details.data) {
            passwordsToTry = generatePermutations(details.data);
        }
    } else if (details.modelId === "DeepGreen") {
        if (details.passwordFormat === "numeric" && details.passwordLength > 0 && details.passwordLength <= MAX_MASTERMIND_LENGTH) {
            const solved = await solveMastermind(ns, neighbor, details.passwordLength);
            if (solved !== null) {
                passwordsToTry = [solved];
            }
        }
    } else if (details.modelId === "OctantVoxel") {
        // details.data is "base,encodedValue" (e.g. "2,11001110"); base can be fractional on harder servers.
        const [baseStr, encoded] = (details.data ?? "").split(",");
        const base = Number(baseStr);
        if (encoded && base >= 2 && base <= 36) {
            const decoded = Math.round(decodeBaseN(encoded, base));
            if (!isNaN(decoded)) {
                passwordsToTry = [decoded.toString()];
            }
        }
    } else {
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
        if (ns.scp(scriptName, neighbor, home) && ns.scp(scriptAuthName, neighbor, home) && !ns.isRunning(scriptName, neighbor)) {
            // More threads speeds up this instance's own ns.dnet.authenticate() calls (diminishing
            // returns), so use as many as fit instead of hardcoding 1.
            const threads = maxThreadsFor(ns, scriptName, neighbor);
            if (threads > 0) {
                const pid = ns.exec(scriptName, neighbor, threads);
                if (pid > 0) {
                    sendLog(`[SUCCESS] Deployed core to ${neighbor} (PID: ${pid}, ${threads} threads)`);
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

        // eslint-disable-next-line no-constant-condition
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
        // core.ts (~6.7GB) + heavy-worker.ts (~3.45GB) need ~10.15GB combined; 16GB is the next RAM tier up
        // with headroom, well below the old 32GB bar that left most mid-tier nodes without the heavy solvers.
        if (ns.getServerMaxRam(currentNode) >= 16 && !ns.fileExists("Workers/heavy-worker.js", currentNode)) {
            ns.scp("Workers/heavy-worker.js", currentNode, home);
            const threads = maxThreadsFor(ns, "Workers/heavy-worker.js", currentNode);
            if (threads > 0) {
                ns.exec("Workers/heavy-worker.js", currentNode, threads);
            }
        }

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const neighbors: string[] = ns.dnet.probe();
            for (const neighbor of neighbors) {
                await handleNode(ns, neighbor, home, sendLog);
            }
            await ns.sleep(10000);
        }
    }
}