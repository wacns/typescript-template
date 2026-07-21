/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  let finalMessage = { finished: false, workerExited: true, authResults: false }
  const sanitizeAuthResult = (result) => ({
    success: Boolean(result?.success),
    code: result?.code ?? null,
    message: typeof result?.message === "string" ? result.message : "",
    data: typeof result?.data === "string" ? result.data : result?.data ?? null
  })
  const sanitizeLabReport = (report) => {
    if (!report || typeof report !== "object") return false
    return {
      success: report.success !== false,
      coords: Array.isArray(report.coords) ? report.coords.slice() : null,
      north: Boolean(report.north),
      east: Boolean(report.east),
      south: Boolean(report.south),
      west: Boolean(report.west)
    }
  }
  const currentRoomCommand = "nothing"
  ns.nextPortWrite(24).then(() => { ns.clearPort(26); ns.exit() })
  ns.atExit(() => { ns.writePort(ns.args[1], finalMessage) })
  while (true) {
    let dir = ns.readPort(ns.pid)
    if (dir === "NULL PORT DATA") {
      await ns.nextPortWrite(ns.pid)
      dir = ns.readPort(ns.pid)
    }
    if (typeof dir !== "string") dir = ""
    if (dir === currentRoomCommand) {
      ns.writePort(ns.args[1], { finished: false, report: sanitizeLabReport(await ns.dnet.labreport()), authResults: false })
      continue
    }
    const results = await ns.dnet.authenticate(ns.args[0], dir)
    const response = { finished: Boolean(results?.success), authResults: sanitizeAuthResult(results) }
    if (results.success) {
      finalMessage = response
      ns.writePort(ns.args[1], response)
      ns.exit()
    }
    else {
      ns.writePort(ns.args[1], response)
    }
  }
}