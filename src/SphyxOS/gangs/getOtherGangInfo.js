/** @param {NS} ns */
export async function main(ns) {
  const port = ns.getPortHandle(ns.pid)
  let result
  if (ns.ui.getGameInfo()?.versionNumber >= 48) result =  ns.gang.getAllGangInformation()
  else result = ns.gang.getOtherGangInformation()
  ns.atExit(() => port.write(result))
}