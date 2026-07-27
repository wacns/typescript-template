import {NS} from "@ns";

export function romanToInt(s: string): number {
    const map: { [key: string]: number } = {I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000};
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

/**
 * ns.dnet.authenticate() speeds up with more threads on the calling script (diminishing returns:
 * 1/(1+0.2*(threads-1)) of the base time), but exec() always needs an explicit thread count - this
 * computes the most threads that fit in a host's free RAM instead of hardcoding 1.
 */
export function maxThreadsFor(ns: NS, script: string, host: string): number {
    const scriptRam = ns.getScriptRam(script, host);
    if (scriptRam <= 0) return 0;
    const availableRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    return Math.max(1, Math.floor(availableRam / scriptRam));
}

/** Tries each candidate password against neighbor until one succeeds. Returns the winning password, or null. */
export async function tryPasswords(ns: NS, neighbor: string, candidates: string[]): Promise<string | null> {
    for (const pwd of candidates) {
        const res = await ns.dnet.authenticate(neighbor, pwd);
        if (res.success) return pwd;
    }
    return null;
}

export const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];

/** LargestPrimeFactor targets are largestPrime * (product of smallPrimes); stripping every smallPrimes factor leaves it. */
export function stripSmallPrimeFactors(targetNumber: string): string {
    let n = BigInt(targetNumber);
    for (const p of SMALL_PRIMES) {
        const bp = BigInt(p);
        while (n % bp === 0n) n /= bp;
    }
    return n.toString();
}

/** Decodes BinaryEncodedFeedback's data: space-separated 8-bit binary strings, one per ASCII character. */
export function decodeBinaryAscii(data: string): string {
    return data
        .split(" ")
        .map(bits => String.fromCharCode(parseInt(bits, 2)))
        .join("");
}

/** Decodes an XOR-masked password given "ciphertext;mask1 mask2 ..." (each mask an 8-bit binary string). */
export function decodeXorMask(data: string): string | null {
    const [ciphertext, masksStr] = data.split(";");
    if (!ciphertext || !masksStr) return null;
    const masks = masksStr.split(" ").map(b => parseInt(b, 2));
    if (masks.length !== ciphertext.length || masks.some(isNaN)) return null;
    return ciphertext
        .split("")
        .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ masks[i]))
        .join("");
}

/**
 * Ports the game's own safe arithmetic-expression parser. Some servers append a trailing
 * `, ns.exit(), ...` payload meant to trip up a naive eval()-based solver — dropping everything
 * from the first comma onward (like the game's own cleanArithmeticExpression) neutralizes that.
 */
export function parseSafeArithmeticExpression(rawExpression: string): number {
    const expression = rawExpression
        .replaceAll("ҳ", "*")
        .replaceAll("÷", "/")
        .replaceAll("➕", "+")
        .replaceAll("➖", "-")
        .split(",")[0];

    const tokens = expression.split("");

    let currentDepth = 0;
    const depth = tokens.map(token => {
        if (token === "(") {
            currentDepth += 1;
        } else if (token === ")") {
            currentDepth -= 1;
            return currentDepth + 1;
        }
        return currentDepth;
    });
    const depth1Start = depth.indexOf(1);
    const firstZeroAfterDepth1Start = depth.indexOf(0, depth1Start);
    const depth1End = firstZeroAfterDepth1Start === -1 ? depth.length - 1 : firstZeroAfterDepth1Start - 1;
    if (depth1Start !== -1) {
        const subExpression = tokens.slice(depth1Start + 1, depth1End).join("");
        const result = parseSafeArithmeticExpression(subExpression);
        tokens.splice(depth1Start, depth1End - depth1Start + 1, result.toString());
        return parseSafeArithmeticExpression(tokens.join(""));
    }

    let remaining = tokens.join("");

    const mulDivRegex = /(-?\d*\.?\d+) *([*/]) *(-?\d*\.?\d+)/;
    let match = remaining.match(mulDivRegex);
    while (match) {
        const [whole, left, operator, right] = match;
        const result = operator === "*" ? parseFloat(left) * parseFloat(right) : parseFloat(left) / parseFloat(right);
        const resultString = Math.abs(result) < 0.000001 ? result.toFixed(20) : result.toString();
        remaining = remaining.replace(whole, resultString);
        match = remaining.match(mulDivRegex);
    }

    const addSubRegex = /(-?\d*\.?\d+) *([+-]) *(-?\d*\.?\d+)/;
    match = remaining.match(addSubRegex);
    while (match) {
        const [whole, left, operator, right] = match;
        const result = operator === "+" ? parseFloat(left) + parseFloat(right) : parseFloat(left) - parseFloat(right);
        remaining = remaining.replace(whole, result.toString());
        match = remaining.match(addSubRegex);
    }

    const [, leftover] = remaining.match(/(-?\d*\.?\d+)/) ?? ["", ""];
    return parseFloat(leftover);
}

export const COMMON_PASSWORD_DICTIONARY = [
    "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234", "111111", "1234567", "dragon",
    "123123", "baseball", "abc123", "football", "monkey", "letmein", "696969", "shadow", "master", "666666",
    "qwertyuiop", "123321", "mustang", "1234567890", "michael", "654321", "superman", "1qaz2wsx", "7777777", "121212",
    "0", "qazwsx", "123qwe", "trustno1", "jordan", "jennifer", "zxcvbnm", "asdfgh", "hunter", "buster",
    "soccer", "harley", "batman", "andrew", "tigger", "sunshine", "iloveyou", "2000", "charlie", "robert",
    "thomas", "hockey", "ranger", "daniel", "starwars", "112233", "george", "computer", "michelle", "jessica",
    "pepper", "1111", "zxcvbn", "555555", "11111111", "131313", "freedom", "777777", "pass", "maggie",
    "159753", "aaaaaa", "ginger", "princess", "joshua", "cheese", "amanda", "summer", "love", "ashley",
    "6969", "nicole", "chelsea", "biteme", "matthew", "access", "yankees", "987654321", "dallas", "austin",
    "thunder", "taylor", "matrix"
];

export const EU_COUNTRIES = [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Republic of Cyprus", "Czech Republic", "Denmark", "Estonia",
    "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg",
    "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"
];
