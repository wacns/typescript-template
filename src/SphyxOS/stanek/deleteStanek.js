import { proxy } from "SphyxOS/util.js"
/** @param {NS} ns */
export async function main(ns) {
  const fileLocation = "/SphyxOSUserData/stanekLoadouts/"
  await proxy(ns, "stanek.acceptGift")
  while (true) {
    const files = ns.ls("home", fileLocation).map(m => [m.substring(fileLocation.length - 1), fileLocation])

    let usableFiles = []
    for (const testFile of files) {
      //const testFile = file.substring(12)
      const [width, hight, ...fileName] = testFile[0].substring(0, testFile[0].length - 4).split("x")
      usableFiles.push([width + "x" + hight + "x" + fileName.join("x"), testFile[1]])
    }
    usableFiles = usableFiles.sort((a, b) => {
      const [width, height] = a[0].split("x")
      const [width2, height2] = b[0].split("x")
      return (width2 + height2) - (width + height)
    })
    const selectable = []
    for (const usableFile of usableFiles) {
      selectable.push(usableFile[0])
    }
    if (selectable.length === 0) {
      ns.toast("No more Stanek layouts to process.", "warning", 3000)
      ns.exit()
    }
    const chosen = await ns.prompt("Choose the loadout to delete:", { type: "select", choices: selectable.sort((a, b) => b[0] > a[0]) })
    if (chosen === "") {
      //ns.toast("Exited out of Stanek removal script.", "error", 3000)
      ns.exit()
    }
    else {
      let prefix = "/SphyxOSUserData/stanekLoadouts/"
      for (const file of usableFiles) {
        if (chosen === file[0]) {
          prefix = file[1]
          break
        }
      }
      if (await proxy(ns, "rm", prefix + chosen + ".txt", "home"))
        ns.toast("SUCCESS: Delete Stanek " + prefix + chosen + ".txt", "success", 3000)
      else ns.toast("FAILURE: Failed to delete Stanek " + prefix + chosen + ".txt", "error", 3000)
    }
  }
}
