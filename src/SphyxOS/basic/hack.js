export const hackReady = true
/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  await ns.hack(ns.args[0], { additionalMsec: ns.args[1] })
}