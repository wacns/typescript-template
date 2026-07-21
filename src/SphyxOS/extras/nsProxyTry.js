/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  let [func, ...argmnts] = ns.args
  let nsFunction = ns
  for (let prop of func.split(".")) nsFunction = nsFunction[prop]
  let result = false
  try {
    const res = nsFunction(...argmnts)
    if (res) result = res
    else result = true
  }
  catch { }
  ns.atExit(() => ns.writePort(ns.pid, result))
}