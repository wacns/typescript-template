import {NS} from "@ns";

/** @param {NS} ns */
export async function main(ns: NS) {
    const file = "SphyxOS.txt"
    await ns.wget("https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOS.txt", file)
    const collection = JSON.parse(ns.read(file))
    for (const item of collection) {
        ns.write(item.filename, JSON.parse(item.file), "w")
    }
    ns.rm(file)
    ns.tprintf("Run Loader.js")
}