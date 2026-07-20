import { NS } from "@ns";
import { runHackLoop } from "lib/hack-loop";

/** @param {NS} ns */
export async function main(ns: NS) {
    const target = ns.args[0] as string;
    if (!target) return;

    await runHackLoop(ns, target);
}