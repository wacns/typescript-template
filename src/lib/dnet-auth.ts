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

/** Tries each candidate password against neighbor until one succeeds. Returns the winning password, or null. */
export async function tryPasswords(ns: NS, neighbor: string, candidates: string[]): Promise<string | null> {
    for (const pwd of candidates) {
        const res = await ns.dnet.authenticate(neighbor, pwd);
        if (res.success) return pwd;
    }
    return null;
}
