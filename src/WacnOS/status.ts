import {NS} from "@ns";
import {WacnPorts} from "WacnOS/ports";

/** A compact live snapshot hackloop.ts broadcasts every cycle, for any UI (WLoader.tsx) to read without an RPC round-trip. */
export interface HackLoopStatus {
    target: string;
    phase: string;
    securityCur: number;
    securityMin: number;
    moneyCur: number;
    moneyMax: number;
    threads: number;
    moneyMode: boolean;
    purchaseMode: boolean;
    updatedAt: number;
}

export function publishHackLoopStatus(ns: NS, status: HackLoopStatus): void {
    ns.clearPort(WacnPorts.HACKLOOP_STATUS);
    ns.writePort(WacnPorts.HACKLOOP_STATUS, JSON.stringify(status));
}

export function readHackLoopStatus(ns: NS): HackLoopStatus | null {
    const raw = ns.peek(WacnPorts.HACKLOOP_STATUS);
    if (raw === "NULL PORT DATA") return null;
    try {
        return JSON.parse(String(raw)) as HackLoopStatus;
    } catch {
        return null;
    }
}

/** Where the autopilot currently is in its BN1 -> BitVerse ladder. See autopilot/decide.ts. */
export type Phase =
    | "BOOT"
    | "DEGRADED"
    | "PAUSED"
    | "IDLE"
    | "INFRA"
    | "MONEY_CASINO"
    | "FACTION_JOIN"
    | "FACTION_UNLOCK"
    | "FACTION_REP"
    | "BUY_AUGS"
    | "INSTALL"
    | "DAEDALUS_UNLOCK"
    | "DAEDALUS_REP"
    | "RED_PILL"
    | "WD_BACKDOOR"
    | "BITVERSE"
    | "HANDOFF";

/** The autopilot's live snapshot, broadcast every tick for WLoader.tsx to render. */
export interface AutopilotStatus {
    phase: Phase;
    /** Human-readable one-liner for the phase, e.g. "grinding CyberSec rep". */
    label: string;
    /** Ladder position, e.g. "3/8" - SphyxOS's own progress idiom. */
    step: string;
    bitNode: number;
    nextBitNode: number;
    route: string;
    moveOn: boolean;
    /** Distinct installed augmentations (NeuroFlux counted once) - the Daedalus gate. */
    ownedAugs: number;
    queuedAugs: number;
    augGoal: number;
    daedalusRep: number;
    daedalusRepGoal: number;
    /** Estimated ms to the rep goal from live sampling, or -1 when not yet measurable. */
    daedalusEtaMs: number;
    money: number;
    hacking: number;
    paused: boolean;
    pausedReason: string;
    /** The selector that last failed, so a fix is a one-line change in WacnOS/dom/. */
    lastSelectorMiss: string;
    /** False when the webpack read-bridge is unavailable; the daemon then refuses to buy or install. */
    bridgeOk: boolean;
    updatedAt: number;
}

export function publishAutopilotStatus(ns: NS, status: AutopilotStatus): void {
    ns.clearPort(WacnPorts.AUTOPILOT_STATUS);
    ns.writePort(WacnPorts.AUTOPILOT_STATUS, JSON.stringify(status));
}

export function readAutopilotStatus(ns: NS): AutopilotStatus | null {
    const raw = ns.peek(WacnPorts.AUTOPILOT_STATUS);
    if (raw === "NULL PORT DATA") return null;
    try {
        return JSON.parse(String(raw)) as AutopilotStatus;
    } catch {
        return null;
    }
}
