import { getServersLight, runIt } from "SphyxOS/util.js"
/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  ns.clearLog()
  ns.atExit(() => ns.writePort(ns.pid, true))
  if (!ns.args.includes("quiet")) ns.ui.openTail()
  const all = ns.args.includes("all")
  const allServers = await getServersLight(ns)
  const purchasedServers = getNames(ns)
  const hackingLevel = ns.getHackingLevel()
  const servers = all ? allServers.filter((s) => s !== "home" && !s.startsWith("hacknet") && !purchasedServers.includes(s) && hackingLevel >= ns.getServerRequiredHackingLevel(s) && ns.getServer(s).hasAdminRights && !ns.getServer(s).backdoorInstalled)
    : ns.args.includes("autopilot") ? targetsAutoPilot.filter((s) => ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(s) && ns.getServer(s).hasAdminRights && !ns.getServer(s).backdoorInstalled)
      : targets.filter((s) => ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(s) && ns.getServer(s).hasAdminRights && !ns.getServer(s).backdoorInstalled)
  servers.sort()
  const startTime = performance.now()
  ns.printf("Servers: %s", servers.length)
  let eta = 0
  servers.forEach(s => eta += (ns.getHackTime(s) / 4))
  ns.printf("Max ETA: %s", fTime(ns, eta), 3)
  let runningScripts = 0
  for (let point of servers) {
    let target = point
    const path = [target]
    while ((target = ns.scan(target)[0]) !== "home") path.unshift(target)
    path.unshift("home")
    for (const server of path)
      ns.singularity.connect(server)
    const runningPid = await runIt(ns, "SphyxOS/singularity/backdoor.js", true, [], 0, true)
    if (runningPid === 0) {
      ns.printf("Server(Local): %s - %s", point, fTime(ns, ns.getHackTime(point) / 4))
      await ns.singularity.installBackdoor()
      ns.printf("Installed backdoor on %s", point)
    }
    else {
      runningScripts++
      ns.printf("Server(Remote): %s - %s", point, fTime(ns, ns.getHackTime(point) / 4))
      ns.nextPortWrite(runningPid).then(() => {
        ns.printf("Installed backdoor on %s", point)
        runningScripts--
      })
      await ns.asleep(100) //Let the backdoor script run
    }
  }
  if (servers.length > 0) ns.singularity.connect("home")
  while (runningScripts > 0) await ns.asleep(1000)
  ns.printf("Finished %s servers in %s", servers.length, fTime(ns, performance.now() - startTime))
}
/** @param {NS} ns */
function getNames(ns) {
  if (ns.ui.getGameInfo()?.versionNumber >= 45) return ns.cloud.getServerNames()
  else return ns.getPurchasedServers()
}
function fTime(ns, ms, msPrecision = false) {
  if (ns.ui.getGameInfo()?.versionNumber >= 44) return ns.format.time(ms, msPrecision)
  else return ns.tFormat(ms, msPrecision)
}
const targets = [
  "CSEC",
  "I.I.I.I",
  "avmnite-02h",
  "run4theh111z",
  "powerhouse-fitness",
  "fulcrumassets"
]
const targetsAutoPilot = [
  "CSEC",
  "I.I.I.I",
  "avmnite-02h",
  "run4theh111z"
]