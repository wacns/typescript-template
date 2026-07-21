export const growReady = true
/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  await ns.grow(ns.args[0], { additionalMsec: ns.args[1] })
  //ns.tprintf("Grow")
}