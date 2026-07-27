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
