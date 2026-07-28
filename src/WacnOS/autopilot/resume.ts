import {NS} from "@ns";
import {NextNodeDriver, RouteId} from "WacnOS/config";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Surviving a prestige.
 *
 * With Source-File 4, SphyxOS hands a callback script to ns.singularity.installAugmentations and
 * the game restarts it automatically. We have no such hook: installing augmentations or entering a
 * BitNode kills every running script, and nothing brings them back.
 *
 * What DOES survive is the browser itself. Bitburner never tears down the JS realm on prestige -
 * there is no clearInterval sweep and no location.reload anywhere in Prestige.ts or RedPill.tsx
 * (the prestige even schedules a setTimeout of its own for its dialog). So a timer registered
 * before the irreversible click keeps running after it, and can type the relaunch command into the
 * terminal on our behalf.
 *
 * Two independent safety nets, because this is the single point of failure for unattended running:
 *
 *   1. The armed timer (fast path) - relaunches within seconds, no user involvement.
 *   2. A marker FILE (slow path) - survives even a full page reload, which does kill the timer.
 *      With autopilotAutoStart on, or a manual `run WacnOS/WLoader.js`, the marker restores the
 *      exact same state.
 */

const MARKER_FILE = "WacnOS/resume.txt";
/** Handle of the repeating attempt timer, once the initial delay has elapsed. */
const TIMER_KEY = "__wacnResumeTimer";
/** Handle of the initial delay itself - tracked separately so disarming during the delay works. */
const DELAY_KEY = "__wacnResumeDelay";
const DEFAULT_COMMAND = "run WacnOS/WLoader.js autopilot";

export interface ResumeMarker {
    /** What we were about to do when the game restarted us. */
    stage: "install" | "bitverse";
    /** BitNode we expect to be in afterwards - lets the loader decide on the handoff. */
    bitNode: number;
    handoff: NextNodeDriver;
    route: RouteId;
    writtenAt: number;
}

export function writeMarker(ns: NS, marker: ResumeMarker): void {
    ns.write(MARKER_FILE, JSON.stringify(marker), "w");
}

export function readMarker(ns: NS): ResumeMarker | null {
    try {
        const raw = ns.read(MARKER_FILE);
        if (!raw) return null;
        return JSON.parse(String(raw)) as ResumeMarker;
    } catch {
        return null;
    }
}

export function clearMarker(ns: NS): void {
    if (ns.fileExists(MARKER_FILE, "home")) ns.rm(MARKER_FILE, "home");
}

/**
 * Registers a browser timer that types the relaunch command into the terminal.
 *
 * Everything the callback needs is INLINED. It must not close over anything from this module or
 * any other: by the time it fires, the script that armed it is gone, and depending on imported
 * bindings that may have been torn down is exactly the kind of failure that would only show up
 * hours into an unattended run.
 *
 * Retries because the game is mid-transition when the timer first fires - the terminal may not be
 * mounted yet, and a dialog usually sits on top of it.
 */
export function armRelaunch(delayMs = 8000, command = DEFAULT_COMMAND): void {
    const g = globalThis as any;

    // Never stack timers - re-arming replaces any previous attempt, in either of its two phases.
    disarmRelaunch();

    g[DELAY_KEY] = g.setTimeout(() => {
        g[DELAY_KEY] = undefined;
        let attempts = 0;

        const tick = (): void => {
            attempts++;
            if (attempts > 20) {
                g.clearInterval(g[TIMER_KEY]);
                g[TIMER_KEY] = undefined;
                return;
            }

            try {
                const doc = g["document"];
                if (!doc) return;

                const props = (el: any): any => {
                    if (!el) return null;
                    const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
                    return key ? el[key] : null;
                };

                // Clear whatever dialog the prestige raised. Only ever safe controls: the modal
                // close icon, or a plainly harmless button. Never anything that commits an action.
                const modal = doc.querySelector(".MuiModal-root");
                if (modal) {
                    const safe = Array.from(modal.querySelectorAll("button")).find((b: any) => {
                        const text = (b.textContent || "").trim();
                        return text === "OK" || text === "Close" || text === "Cancel" || text === "Decide later";
                    }) as any;
                    const closeIcon = modal.querySelector("button svg[data-testid='CloseIcon']");
                    const target = safe ?? (closeIcon ? closeIcon.closest("button") : null);
                    const p = props(target);
                    if (p?.onClick) p.onClick({isTrusted: true, preventDefault: () => undefined});
                    else if (target) target.click();
                    return; // give the modal a tick to close, then retry
                }

                // Switch to the Terminal tab. The label is a MUI Typography (a <p>), so match any
                // element, then walk up to whichever ancestor actually carries the click handler.
                if (!doc.getElementById("terminal-input")) {
                    const drawer = doc.querySelector(".MuiDrawer-root");
                    if (drawer) {
                        const label = Array.from(drawer.querySelectorAll("*")).find(
                            (el: any) => (el.textContent || "").trim() === "Terminal" && el.children.length === 0,
                        ) as any;
                        let node = label;
                        for (let up = 0; up < 6 && node; up++) {
                            const p = props(node);
                            if (p?.onClick) {
                                p.onClick({isTrusted: true, preventDefault: () => undefined});
                                break;
                            }
                            node = node.parentElement;
                        }
                    }
                    return; // let the page render the terminal, then retry
                }

                const input = doc.getElementById("terminal-input");
                const p = props(input);
                if (!p?.onChange || !p?.onKeyDown) return;

                p.onChange({target: {value: command}, isTrusted: true});
                p.onKeyDown({key: "Enter", isTrusted: true, preventDefault: () => undefined});

                g.clearInterval(g[TIMER_KEY]);
                g[TIMER_KEY] = undefined;
            } catch {
                // Keep retrying - the game may simply not be ready yet.
            }
        };

        g[TIMER_KEY] = g.setInterval(tick, 3000);
        tick();
    }, delayMs);
}

/**
 * Cancels a pending relaunch, in whichever of its two phases it is - still waiting out the initial
 * delay, or already retrying. Clearing only the interval would leave a pending setTimeout that
 * later arms an interval nothing can cancel.
 */
export function disarmRelaunch(): void {
    const g = globalThis as any;
    if (g[DELAY_KEY]) {
        g.clearTimeout(g[DELAY_KEY]);
        g[DELAY_KEY] = undefined;
    }
    if (g[TIMER_KEY]) {
        g.clearInterval(g[TIMER_KEY]);
        g[TIMER_KEY] = undefined;
    }
}

/** True while a relaunch is pending, in either phase. */
export function isRelaunchArmed(): boolean {
    const g = globalThis as any;
    return Boolean(g[DELAY_KEY] || g[TIMER_KEY]);
}

/**
 * Prepares for an action that will kill this script, in the order that matters: persist the marker
 * first (so a page reload can still recover), then arm the timer. The caller performs the
 * irreversible click only after this returns.
 */
export function prepareForRestart(ns: NS, marker: ResumeMarker, delayMs = 8000): void {
    writeMarker(ns, marker);
    armRelaunch(delayMs);
}
