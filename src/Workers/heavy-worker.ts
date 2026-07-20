import { NS } from "@ns";
import { romanToInt, tryPasswords } from "lib/dnet-auth";

// Factori-Os passwords are built by the game as (a random base) * (a handful of small-prime/1-5 factors),
// scaled by server difficulty. Reproducing that structure gives a far smaller, far more accurate candidate
// set than brute-forcing every number of a given digit length.
const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
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
        const res = await ns.dnet.heartbleed(neighbor, { logsToCapture: 10 });
        if (!res.success) return null;

        for (const line of res.logs) {
            const match = line.match(/Logging in with passcode:\s*(\S+)/);
            if (match) return match[1];
        }
    }
    return null;
}

// PHP 5.4 (SortedEchoVuln) hints show the password's digits sorted, not the password itself; the real
// password is some permutation of those digits. Above this many characters the permutation count explodes.
const MAX_PERMUTATION_LENGTH = 6;

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

// DeepGreen (MastermindHint) is a real Mastermind game: each failed authenticate() attempt returns
// "exactCount,misplacedCount" feedback in res.data, scored the same way as classic Mastermind (exact
// position matches, plus correct-but-misplaced characters, both accounting for duplicates). Above this
// length the initial all-numeric candidate pool gets too large to build/filter practically.
const MAX_MASTERMIND_LENGTH = 5;
const MAX_MASTERMIND_GUESSES = 20;

function getExactCorrectCharsCount(password: string, attempt: string): number {
    let count = 0;
    for (let i = 0; i < password.length; i++) {
        if (password[i] === attempt[i]) count++;
    }
    return count;
}

function getMisplacedCorrectCharsCount(password: string, attempt: string): number {
    const remainingPasswordChars = password.split("").filter((c, i) => c !== attempt[i]);
    const remainingAttemptChars = attempt.split("").filter((c, i) => c !== password[i]);

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
        const attempt = candidates[0];
        const res = await ns.dnet.authenticate(neighbor, attempt);
        if (res.success) return attempt;

        const [exactStr, misplacedStr] = String(res.data ?? "0,0").split(",");
        const exact = parseInt(exactStr) || 0;
        const misplaced = parseInt(misplacedStr) || 0;

        candidates = candidates.filter(c =>
            c !== attempt &&
            getExactCorrectCharsCount(c, attempt) === exact &&
            getMisplacedCorrectCharsCount(c, attempt) === misplaced
        );
    }
    return null;
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

            if (details.modelId === "BellaCuore") {
                const romanMatch = details.passwordHint.match(/\b([IVXLCDMivxlcdm]+)\b/);
                if (romanMatch) {
                    candidates = [romanToInt(romanMatch[1]).toString()];
                }
            }
            else if (details.modelId === "AccountsManager_4.2") {
                const matches = details.passwordHint.match(/between\s+([0-9]+)\s+and\s+([0-9]+)/i);
                const min = matches ? parseInt(matches[1]) : 0;
                const max = matches ? parseInt(matches[2]) : 100;
                candidates = Array.from({ length: max - min + 1 }, (_, i) => (min + i).toString());
            }
            else if (details.modelId === "Factori-Os") {
                candidates = buildFactoriosCandidates(details.difficulty);
            }
            else if (details.modelId === "OpenWebAccessPoint") {
                if (details.requiredCharismaSkill <= ns.getPlayer().skills.charisma) {
                    const leaked = await sniffLeakedPassword(ns, neighbor);
                    if (leaked !== null) {
                        candidates = [leaked];
                    }
                }
            }
            else if (details.modelId === "PHP 5.4") {
                if (details.data) {
                    candidates = generatePermutations(details.data);
                }
            }
            else if (details.modelId === "DeepGreen") {
                if (details.passwordFormat === "numeric" && details.passwordLength > 0 && details.passwordLength <= MAX_MASTERMIND_LENGTH) {
                    const solved = await solveMastermind(ns, neighbor, details.passwordLength);
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