/** @param {NS} ns */
export async function main(ns) {
  //await ns.wget("https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOS.txt", "SphyxOSUserData/loaderData/SphyxOS.txt")
  await ns.sleep(100)
  const collection = JSON.parse(ns.read("SphyxOSUserData/loaderData/SphyxOS.txt"))
  for (const item of collection) {
    ns.write(item.filename, JSON.parse(item.file), "w")
  }
  ns.rm("SphyxOSUserData/loaderData/SphyxOS.txt") //Get rid of our JSON file as we have a hashkey now to check version
  ns.exec("Loader.js", "home")
}