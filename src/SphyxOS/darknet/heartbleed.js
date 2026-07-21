/** @param {NS} ns */
export async function main(ns) {
  const result = await ns.dnet.heartbleed(ns.args[1], { logsToCapture: ns.args[2], additionalMsec: ns.args[3] })
  ns.atExit(() => ns.writePort(ns.pid, result))
}