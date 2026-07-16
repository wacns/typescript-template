import {NS} from "@ns";

/** @param {NS} ns */
export async function main(ns: NS) {
    // Infinite loop to continuously provide the share multiplier
    while (true) {
        await ns.share();
    }
}