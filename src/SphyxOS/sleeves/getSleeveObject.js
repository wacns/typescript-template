/** @param {NS} ns */
export async function main(ns) {
  const sleeves = []
  for (let slv = 0; slv < ns.sleeve.getNumSleeves(); slv++) {
    const task = ns.sleeve.getTask(slv)
    if (task === null) {
      const record = {
        "num": slv,
        "me": ns.sleeve.getSleeve(slv),
        "task": null
      }
      sleeves.push(record)
    }
    else {
      const {nextCompletion, ...tasks} = ns.sleeve.getTask(slv)
      const record = {
        "num": slv,
        "me": ns.sleeve.getSleeve(slv),
        "task": tasks
      }
      sleeves.push(record)
    }
  }
  ns.atExit(() => ns.writePort(ns.pid, sleeves))
}