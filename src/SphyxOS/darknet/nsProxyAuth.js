/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  let [server, password, func, ...argmnts] = ns.args
  let nsFunction = ns
  for (let prop of func.split(".")) nsFunction = nsFunction[prop]
  ns.dnet.connectToSession(server, password)
  let finalResult
  try {
    const result = nsFunction(...argmnts)
    if (result instanceof Promise) finalResult = await result
    else if (result instanceof Object) {
      promiseRemoval(result)
      finalResult = result
    }
    else finalResult = result

    if (func === "dnet.memoryReallocation" && finalResult && typeof finalResult === "object") //Sanitize memoryReallocation commands to reduce memory consumption
      finalResult = { success: finalResult.success === true, code: finalResult.code ?? null }
      
  } catch { } //finalResult is undefined if it failed to run.
  ns.atExit(() => ns.writePort(ns.pid, finalResult))
}
function promiseRemoval(object) {
  for (const key in object)
    if (object[key] instanceof Promise) delete object[key]
    else if (object[key] instanceof Object) promiseRemoval(object[key])
}