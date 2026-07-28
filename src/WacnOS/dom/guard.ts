import {NS} from "@ns";
import {WacnPorts} from "WacnOS/ports";

/**
 * Thrown when a UI element the autopilot needs simply isn't there. Carries the selector so the
 * failure report names the exact thing to fix - a broken selector should be a one-line change in
 * WacnOS/dom/, and that's only true if we know which one broke.
 */
export class SelectorError extends Error {
    constructor(public readonly selector: string, public readonly action: string) {
        super(`WacnOS ${action}: could not find ${selector}`);
        this.name = "SelectorError";
    }
}

export interface GuardState {
    paused: boolean;
    reason: string;
    lastSelectorMiss: string;
}

export const guardState: GuardState = {paused: false, reason: "", lastSelectorMiss: ""};

/**
 * Runs a UI action, converting a missing selector into a controlled stop rather than a crash.
 *
 * With `pauseOnSelectorMiss` the autopilot halts and waits for the user to press [RESUME] or
 * [SKIP] in the loader - the right default, because silently continuing past a failed click
 * usually means the next action operates on the wrong screen. With it off, the miss is recorded
 * and the tick simply retries later, which is what you want for an unattended overnight run
 * where one flaky selector shouldn't stall everything.
 */
export async function guarded<T>(
    ns: NS,
    action: string,
    fn: () => Promise<T>,
    opts: { pauseOnMiss: boolean },
): Promise<T | null> {
    try {
        return await fn();
    } catch (err) {
        if (!(err instanceof SelectorError)) throw err;

        guardState.lastSelectorMiss = err.selector;
        ns.print(`WARN  ${err.message}`);

        if (!opts.pauseOnMiss) return null;

        guardState.paused = true;
        guardState.reason = `${action}: missing ${err.selector}`;
        ns.toast(`WacnOS autopilot paused - ${action} could not find ${err.selector}`, "error", null);

        // Block here, draining the command port, until the user resolves it from the loader.
        while (guardState.paused) {
            while (ns.peek(WacnPorts.AUTOPILOT_CMD) !== "NULL PORT DATA") {
                const cmd = String(ns.readPort(WacnPorts.AUTOPILOT_CMD));
                if (cmd === "resume" || cmd === "skip") {
                    guardState.paused = false;
                    guardState.reason = "";
                }
            }
            await ns.asleep(1000);
        }
        return null;
    }
}

/** Throws a SelectorError if `el` is missing - the standard shape for every lookup in dom/actions.ts. */
export function mustFind<T>(el: T | null | undefined, selector: string, action: string): T {
    if (!el) throw new SelectorError(selector, action);
    return el;
}
