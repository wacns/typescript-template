
/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  ns.clearLog()
  ns.ui.openTail()
  virus(ns)
  const servers = targets.filter((s) => ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(s) && ns.hasRootAccess(s) && !ns.getServer(s).backdoorInstalled)//)
  servers.sort()
  ns.print("Stay on the terminal page or the script will fail!")
  ns.printf("Servers: %s", servers.length)
  let eta = 0
  servers.forEach(s => eta += (ns.getHackTime(s) / 4) + 2000)
  if (ns.ui.getGameInfo()?.versionNumber >= 44) ns.printf("ETA: %s", fTime(ns, eta), 3)
  else ns.printf("ETA: %s", fTime(ns, eta), 3)
  for (let point of servers) {
    let target = point
    const path = [target]
    while ((target = ns.scan(target)[0]) !== "home") path.unshift(target)
    path.unshift("home")
    await terminal("connect " + path.join(";connect "))
    await terminal("backdoor")
    await ns.sleep(0)
    if (ns.ui.getGameInfo()?.versionNumber >= 44) ns.printf("%s - %s", point, fTime(ns, (ns.getHackTime(point) / 4) + 2000))
    else ns.printf("%s - %s", point, fTime(ns, (ns.getHackTime(point) / 4) + 2000))
    await ns.sleep((ns.getHackTime(point) / 4) + 2000)
  }
  if (servers.length > 0) await terminal("home")
}

//This will put something into the terminal and hit enter.  You however, need to be on the terminal to do it or it won't work.
async function terminal(text) {
  const slp = ms => new Promise(r => setTimeout(r, ms))
  function find(doc, xpath) { return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }
  function click(elem) {
    elem[Object.keys(elem)[1]].onClick({ isTrusted: true });
  }
  //Are we focused?
  const focused = find(globalThis["document"], "//button[contains(text(), 'Do something else simultaneously')]");
  if (focused) {
    click(focused)
    await slp(0)
  }
  //Capture the terminal button
  const terminal = [...globalThis["document"].querySelectorAll("#root > div > div > div > ul > div > div > div > div")]
  //Click it
  terminal.filter(e => e.textContent === "Terminal")[0]?.click()
  await slp(0)
  //Get the terminal input field
  const input = globalThis["document"].getElementById('terminal-input');
  //Get it's handler
  const handler = Object.keys(input)[1];
  //Set the change that will happen, ie: add it to the terminal
  input[handler].onChange({ target: { value: text } });
  //Click enter on the terminal
  input[handler].onKeyDown({ key: 'Enter', preventDefault: () => null });
}
function virus(ns) {
  const servers = getServersLight(ns)
  for (const server of servers) {
    try { ns.brutessh(server) } catch { }
    try { ns.ftpcrack(server) } catch { }
    try { ns.relaysmtp(server) } catch { }
    try { ns.httpworm(server) } catch { }
    try { ns.sqlinject(server) } catch { }
    try { ns.nuke(server) } catch { }
  }
}
function getServersLight(ns) {
  const serverList = new Set(["home"])
  for (const server of serverList) {
    for (const connection of ns.scan(server)) {
      serverList.add(connection)
    }
  }
  return Array.from(serverList)
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
];