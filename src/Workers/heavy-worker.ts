import {NS} from "@ns";
import {tryPasswords, SMALL_PRIMES} from "lib/dnet-auth";

// Factori-Os passwords are built by the game as (a random base) * (a handful of small-prime/1-5 factors),
// scaled by server difficulty. Reproducing that structure gives a far smaller, far more accurate candidate
// set than brute-forcing every number of a given digit length.
const FACTORIOS_FACTOR_POOL = [1, 2, 3, 4, 5, ...SMALL_PRIMES];
const MAX_FACTORIOS_CANDIDATES = 2000;
const MAX_FACTORIOS_ROUNDS = 3;

/** Builds Factori-Os password candidates by replicating the game's own prime-product generation. */
function buildFactoriosCandidates(difficulty: number): string[] {
    const scale = Math.min(difficulty / 2, 15);
    const baseMax = Math.max(1, Math.floor(5 * (scale + 1)));
    const rounds = Math.min(Math.floor(scale / 3), MAX_FACTORIOS_ROUNDS);

    let candidates = new Set<number>();
    for (let base = 1; base <= baseMax; base++) candidates.add(base);

    for (let round = 0; round < rounds && candidates.size < MAX_FACTORIOS_CANDIDATES; round++) {
        const next = new Set<number>(candidates);
        outer: for (const c of candidates) {
            for (const f of FACTORIOS_FACTOR_POOL) {
                if (next.size >= MAX_FACTORIOS_CANDIDATES) break outer;
                next.add(c * f);
            }
        }
        candidates = next;
    }

    return Array.from(candidates, n => n.toString());
}

/** Reads server logs via heartbleed, looking for a password the server occasionally leaks in its own noise. */
async function sniffLeakedPassword(ns: NS, neighbor: string, attempts = 5): Promise<string | null> {
    for (let i = 0; i < attempts; i++) {
        const res = await ns.dnet.heartbleed(neighbor, {logsToCapture: 10});
        if (!res.success) return null;

        for (const line of res.logs) {
            const match = line.match(/Logging in with passcode:\s*(\S+)/);
            if (match) return match[1];
        }
    }
    return null;
}

const NUMERIC_CHARSET = "0123456789";
const ALPHANUMERIC_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_ORACLE_GUESSES = 600;

// Yesn_t: every failed guessStr returns per-position "yes"/"yesn't" feedback (exact match only, no
// misplaced info) for the whole attempted string. Solve each position independently by cycling through
// the charset at that position (holding already-confirmed positions fixed) until it reports "yes".
async function solveYesnt(ns: NS, neighbor: string, length: number, numeric: boolean): Promise<string | null> {
    const charset = numeric ? NUMERIC_CHARSET : ALPHANUMERIC_CHARSET;
    if (length * charset.length > MAX_ORACLE_GUESSES) return null;

    const guess = new Array(length).fill(charset[0]);
    for (let pos = 0; pos < length; pos++) {
        let solved = false;
        for (const c of charset) {
            guess[pos] = c;
            const candidate = guess.join("");
            const res = await ns.dnet.authenticate(neighbor, candidate);
            if (res.success) return candidate;

            const feedback = String(res.data ?? "").split(",");
            if (feedback[pos] === "yes") {
                solved = true;
                break;
            }
        }
        if (!solved) return null;
    }
    return guess.join("");
}

// TimingAttack: every failed guessStr's message reveals the index of the first character that doesn't
// match the real password (e.g. "... (3)"). Since we already know the true length from
// details.passwordLength, solve it left-to-right: for each position, try charset characters until the
// reported mismatch index moves past that position, confirming it's correct.
async function solveTimingAttack(ns: NS, neighbor: string, length: number, numeric: boolean): Promise<string | null> {
    const charset = numeric ? NUMERIC_CHARSET : ALPHANUMERIC_CHARSET;
    if (length * charset.length > MAX_ORACLE_GUESSES) return null;

    let known = "";
    for (let pos = 0; pos < length; pos++) {
        let foundChar: string | null = null;
        for (const c of charset) {
            const guessStr = known + c;
            const res = await ns.dnet.authenticate(neighbor, guessStr);
            if (res.success) return guessStr;

            const match = res.message.match(/\((-?\d+)\)/);
            const indexOfDiff = match ? parseInt(match[1]) : -1;
            if (indexOfDiff > pos || indexOfDiff === -1) {
                foundChar = c;
                break;
            }
        }
        if (foundChar === null) return null;
        known += foundChar;
    }
    return known;
}

export async function main(ns: NS): Promise<void> {
    const currentNode = ns.getHostname();
    ns.disableLog("sleep");

    ns.print(`[HEAVY WORKER] Initialized on high-RAM node ${currentNode}. Ready for complex model solving.`);

    while (true) {
        const neighbors: string[] = ns.dnet.probe();
        for (const neighbor of neighbors) {
            const details = ns.dnet.getServerDetails(neighbor);
            if (!details.isConnectedToCurrentServer || !details.isOnline || details.hasSession) {
                continue;
            }

            let candidates: string[] = [];

            if (details.modelId === "Factori-Os") {
                candidates = buildFactoriosCandidates(details.difficulty);
            } else if (details.modelId === "OpenWebAccessPoint") {
                if (details.requiredCharismaSkill <= ns.getPlayer().skills.charisma) {
                    const leaked = await sniffLeakedPassword(ns, neighbor);
                    if (leaked !== null) {
                        candidates = [leaked];
                    }
                }
            } else if (details.modelId === "NIL") {
                if (details.passwordLength > 0) {
                    const solved = await solveYesnt(ns, neighbor, details.passwordLength, details.passwordFormat === "numeric");
                    if (solved !== null) {
                        candidates = [solved];
                    }
                }
            } else if (details.modelId === "2G_cellular") {
                if (details.passwordLength > 0) {
                    const solved = await solveTimingAttack(ns, neighbor, details.passwordLength, details.passwordFormat === "numeric");
                    if (solved !== null) {
                        candidates = [solved];
                    }
                }
            }

            if (candidates.length > 0) {
                const winner = await tryPasswords(ns, neighbor, candidates);
                if (winner !== null) {
                    ns.print(`[HEAVY SOLVER] Cracked ${neighbor} using advanced solver.`);
                }
            }
        }
        await ns.sleep(15000);
    }
}