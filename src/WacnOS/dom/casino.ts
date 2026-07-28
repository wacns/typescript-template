import {NS} from "@ns";
import {byExactText, click, find, setValue, sleep} from "WacnOS/dom/doc";
import {SelectorError} from "WacnOS/dom/guard";
import {dismissModals} from "WacnOS/dom/nav";
import {ActionResult, openLocation} from "WacnOS/dom/actions";
import {getBridge} from "WacnOS/bridge/webpack";
import {CASINO_LIMIT} from "WacnOS/autopilot/phases";

/**
 * The casino: $10b of essentially free money, once per augmentation install.
 *
 * SphyxOS plays 1024 zero-stake flips to RECORD the outcome sequence, then replays it at full
 * stake - the coin-flip RNG has a period of exactly 1024, so the recording is a valid script for
 * every subsequent cycle.
 *
 * We do something simpler and strictly better: PREDICT. The generator is
 * `x = (341x + 1) mod 1024` (Casino/RNG.ts), a textbook LCG, and the bridge can read its current
 * `x`. So we compute the next value ourselves, bet on it, and win from the very first flip -
 * no recording phase, no reading results out of the DOM, and no 1024 wasted clicks.
 *
 * The one rule: never call the game's own random(). That would advance the sequence and put our
 * prediction permanently out of step.
 */

const CASINO_CITY = "Aevum";
const CASINO_LOCATION = "Iker Molina Casino";
const MAX_BET = 10e3;

/** Money won at the casino since the last install; the game bans you above CASINO_LIMIT. */
export function casinoWinnings(ns: NS): number {
    const bridge = getBridge(String(ns.ui.getGameInfo().version));
    // Player.moneySourceA is exactly what ns.getMoneySources() reports as `sinceInstall`
    // (NetscriptFunctions.ts:1438) - reading it through the bridge avoids that call's 1GB.
    return bridge?.Player?.moneySourceA?.casino ?? 0;
}

export interface CasinoOptions {
    /** Give up after this long regardless of progress. */
    maxMs?: number;
    /** Stop this far below the ban threshold, so we never trip the game's own limit check. */
    margin?: number;
}

/**
 * Plays coin flip until the casino limit is reached.
 *
 * Must already be in Aevum - travelling is the caller's decision, since it costs money and the
 * autopilot may have a better use for the trip.
 */
export async function farmCasino(ns: NS, version: string, opts: CasinoOptions = {}): Promise<ActionResult> {
    const maxMs = opts.maxMs ?? 6 * 60 * 1000;
    // reachedLimit() raises a dialog on EVERY call once winnings exceed the cap, and play() calls
    // it first thing - so stopping a little short keeps the screen clear instead of filling it
    // with modals we then have to dismiss.
    const margin = opts.margin ?? 1e6;
    const target = CASINO_LIMIT - margin;

    if (casinoWinnings(ns) >= target) return {ok: true};
    if (ns.getPlayer().city !== CASINO_CITY) {
        return {ok: false, reason: `casino is in ${CASINO_CITY}, currently in ${ns.getPlayer().city}`};
    }

    const bridge = getBridge(version);
    const rng = bridge?.BadRNG;
    if (!rng) {
        return {ok: false, reason: "could not locate the casino RNG through the bridge"};
    }

    const opened = await openLocation(ns, CASINO_LOCATION, version);
    if (!opened.ok) return opened;

    const coinFlip = await waitForButton("Play coin flip");
    if (!coinFlip) throw new SelectorError("Play coin flip button", "farmCasino");
    click(coinFlip);
    await sleep(200);

    const bet = find("//input[@type='number']");
    if (!bet) throw new SelectorError("casino bet input", "farmCasino");
    setValue(bet, MAX_BET);
    await sleep(100);

    const head = byExactText("button", "Head!");
    const tail = byExactText("button", "Tail!");
    if (!head || !tail) throw new SelectorError("Head!/Tail! buttons", "farmCasino");

    const deadline = Date.now() + maxMs;
    let flips = 0;
    let stalls = 0;
    let last = casinoWinnings(ns);

    while (casinoWinnings(ns) < target) {
        if (Date.now() > deadline) {
            return {ok: false, reason: `casino timed out after ${flips} flips at ${ns.format.number(casinoWinnings(ns))}`};
        }

        // Predict the next draw exactly as the game will compute it. `random()` returns x/m, and
        // play() reads Head when that is below 0.5 (CoinFlip.tsx:32-36).
        const next = (rng.a * rng.x + rng.c) % rng.m;
        click(next / rng.m < 0.5 ? head : tail);
        flips++;

        // Yield so React can commit and the game can settle before the next click.
        if (flips % 25 === 0) {
            await sleep(0);

            const now = casinoWinnings(ns);
            if (now <= last) {
                // Not winning: either the buttons stopped responding or we've desynchronised.
                if (++stalls >= 8) {
                    return {ok: false, reason: `casino stalled after ${flips} flips (prediction may be out of step)`};
                }
            } else {
                stalls = 0;
            }
            last = now;
        }
    }

    await dismissModals();
    return {ok: true};
}

async function waitForButton(text: string): Promise<HTMLElement | null> {
    for (let i = 0; i < 20; i++) {
        const button = byExactText("button", text);
        if (button) return button;
        await sleep(100);
    }
    return null;
}
