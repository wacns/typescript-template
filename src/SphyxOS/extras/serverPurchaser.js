/** @param {NS} ns */
export async function main(ns) {
  let upgradecost = 1e150
  const port = ns.getPortHandle(ns.pid)
  ns.atExit(() => port.write(upgradecost))

  const startRam = 2
  // Itterator we'll use for our loop
  let i = getNames(ns).length
  if (getLimit(ns) === 0) return

  //Buy the base servers
  while (i < getLimit(ns)) {
    // Check if we have enough money to purchase a server
    if (ns.getServerMoneyAvailable("home") >= getCost(ns, startRam)) {
      const server = i >= 10 ? buy(ns, "pserv-" + i, startRam) : buy(ns, "pserv-0" + i, startRam)
      ns.scp("SphyxOS/basic/weaken.js", server, "home")
      ns.scp("SphyxOS/basic/grow.js", server, "home")
      ns.scp("SphyxOS/basic/hack.js", server, "home")
      ns.scp("SphyxOS/util.js", server, "home")
      ns.scp("SphyxOS/forms.js", server, "home")
      i++;
    }
    else {
      upgradecost = getCost(ns, startRam)
      return
    }
  }

  const servers = getNames(ns)
  while (true) {
    //Cycle through every server.  Check each attribute for cost of upgrade
    //Upgrade the cheapest.  Keep upgrading indefinitally
    let upgradeitem = ""
    let ramupgrade = 0
    upgradecost = 1e150

    //Check all servers
    for (const server of servers) {
      //Get the cheapest one and document it
      if (getUpgradeCost(ns, server, ns.getServerMaxRam(server) * 2) < upgradecost) {
        upgradecost = getUpgradeCost(ns, server, ns.getServerMaxRam(server) * 2)
        upgradeitem = server
        ramupgrade = ns.getServerMaxRam(server) * 2
      }
    }
    //upgrade the server if we can
    if (ns.getServerMoneyAvailable("home") >= upgradecost) upgrade(ns, upgradeitem, ramupgrade)
    else {
      upgradecost = upgradecost === Number.POSITIVE_INFINITY ? 0 : upgradecost
      return
    }
  }
}


/** @param {NS} ns */
function getLimit(ns) {
  if (ns.ui.getGameInfo()?.versionNumber >= 45) return ns.cloud.getServerLimit()
  else return ns.getPurchasedServerLimit()
}
/** @param {NS} ns */
function getNames(ns) {
  if (ns.ui.getGameInfo()?.versionNumber >= 45) return ns.cloud.getServerNames()
  else return ns.getPurchasedServers()
}
/** @param {NS} ns */
function buy(ns, id, startRam) {
  if (ns.ui.getGameInfo()?.versionNumber >= 45) return ns.cloud.purchaseServer(id, startRam)
  else return ns.purchaseServer(id, startRam)
}
/** @param {NS} ns */
function getCost(ns, startRam) {
  if (ns.ui.getGameInfo()?.versionNumber >= 45) return ns.cloud.getServerCost(startRam)
  else return ns.getPurchasedServerCost(startRam)
}
/** @param {NS} ns */
function getUpgradeCost(ns, server, newRam) {
  if (ns.ui.getGameInfo()?.versionNumber >= 45) return ns.cloud.getServerUpgradeCost(server, newRam)
  else return ns.getPurchasedServerUpgradeCost(server, newRam)
}
/** @param {NS} ns */
function upgrade(ns, server, newRam) {
  if (ns.ui.getGameInfo()?.versionNumber >= 45) return ns.cloud.upgradeServer(server, newRam)
  else return ns.upgradePurchasedServer(server, newRam)
}