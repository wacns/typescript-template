import { NS } from "@ns";

export function romanToInt(s: string): number {
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

const BASE_N_CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Ports the game's own base-N decoder (supports fractional bases, used by harder OctantVoxel servers). */
export function decodeBaseN(numberString: string, base: number): number {
    let result = 0;
    let index = 0;
    let digit = numberString.split(".")[0].length - 1;

    while (index < numberString.length) {
        const currentDigit = numberString[index];
        if (currentDigit === ".") {
            index += 1;
            continue;
        }
        result += BASE_N_CHARACTERS.indexOf(currentDigit.toUpperCase()) * base ** digit;
        index += 1;
        digit -= 1;
    }

    return result;
}

/** Tries each candidate password against neighbor until one succeeds. Returns the winning password, or null. */
export async function tryPasswords(ns: NS, neighbor: string, candidates: string[]): Promise<string | null> {
    for (const pwd of candidates) {
        const res = await ns.dnet.authenticate(neighbor, pwd);
        if (res.success) return pwd;
    }
    return null;
}
