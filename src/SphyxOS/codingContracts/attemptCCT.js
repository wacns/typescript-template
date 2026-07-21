/** @param {NS} ns */
export async function main(ns) {
  const info = JSON.parse(ns.args[0])
  let results
  ns.atExit(() => ns.writePort(ns.pid, results))
  try { results = ns.codingcontract.attempt(info[0], info[1], info[2]) } catch { results = false }
}