/**Author:
 * Discord: Sphyxis
 */
const killPort = 24 //Kill Switch for all darknet scripts
const cctFile = "SphyxOS/bins/codingContracts.js" //Add your .cct solver here
const telemetryFile = "SphyxOSUserData/darknet/telemetry.txt" //I collect information on puzzle solvers
const completeFile = "SphyxOSUserData/darknet/complete.txt" //Backup of all known passwords
const inProgFile = "SphyxOSUserData/darknet/inProg.txt" //Backup of all in-progress information
const reservedRam = 13.6 + 16//16 is extra.  We need 13.6 over and above the script cost to run every command.  Free mem until then
const minResRam = 3.6 //Min reserve to start a script.  Needed to run reallocateMemory and free the rest
const rateMyPixWorkerStallMs = 5000 //Restart the RateMyPix webworker if candidate search stops responding
const rateMyPixWorkerSearchMs = 1200 //Have RateMyPix workers return progress before the stall watchdog fires
let complete //Module Scoped variable that contains all known passwords.  All darknet scripts share this variable
let inProgress //Contains all in-progress work.  All darknet scripts share this variable
let workingOn //Contains information on which servers are being worked on at the moment
let telemetry //Contains all telemetry data
let workingOnCCT //Flags if a .cct is being done.  Only 1 at a time
let modePhishing = true //If we do phishing
let modeInduce = false //If we try to induce migration
let modeShare = true //If we are sharing ram
let modeStorm = false //If we are starting storms
let modeShowMap = true //If we are showing the lab map as we solve it
let modeStock = "none"
let logOpened = false

/** @param {NS} ns */
export async function main(ns) {
  ns.ramOverride(3.05)
  ns.disableLog("ALL")
  const me = ns.self().server
  writeLabHunter(ns)
  writeProxyLocal(ns)
  writeProxyAuth(ns)
  writeProxyHeartbleed(ns)
  if (me === "home") {
    ns.ramOverride(3.55)
    ns.dnet.connectToSession("darkweb", "")
    ns.scp(ns.self().filename, "darkweb", "home")
    ns.exec(ns.self().filename, "darkweb", { preventDuplicates: true })
    return
  }

  if (ns.pid < 40) {
    ns.ramOverride(3.6)
    ns.spawn(ns.self().filename, { preventDuplicates: true, spawnDelay: 0 })
    ns.exit()
  }
  ns.nextPortWrite(killPort).then(() => { ns.exit() })
  while (me !== "darkweb" && globalThis["SphyxOSDarknetWebWorkers"] == undefined) await ns.asleep(200)
  if (me === "darkweb") { // One time startup routine
    modePhishing = true
    modeInduce = false
    modeShare = true
    modeShowMap = true
    modeStorm = false
    modeStock = "none"
    logOpened = false
    labComplete = false
    labName = false
    workingOnCCT = false
    labState = null
    labWorkerVisitStack = new Map()  // workerId -> string[]
    labInfluenceContextCache = new WeakMap()
    labQuadrantBoundsCoordCache = new WeakMap()
    labGoalwardDirsCache = new WeakMap()
    getCommands(ns) //Start our command listener
    ns.clearPort(26)
    ns.writePort(26, ns.pid)
    ns.atExit(() => { ns.clearPort(26) }, "cleanup")
    if (!complete) try { complete = new Map(JSON.parse(ns.read(completeFile))) } catch { complete = new Map() }
    updateFull("darkweb", "", ns.dnet.getServerDetails("darkweb"))
    if (!inProgress) try {
      const savedProgress = JSON.parse(ns.read(inProgFile))
      inProgress = new Map(Array.isArray(savedProgress) ? savedProgress.filter((entry) => Array.isArray(entry) && entry[1] && typeof entry[1] === "object") : [])
    } catch { inProgress = new Map() }
    pruneSavedDarknetState(ns)

    workingOn = new Map()
    if (await proxyAuth(ns, 1, me, complete.get(me).pw, "scp", telemetryFile, me, "home")) {
      const telemetryData = JSON.parse(ns.read(telemetryFile))
      telemetry = telemetryData
    }
    else telemetry = {} //Left as an object map, as it should not contain names that are prohibited
    await proxyLocal(ns, 1, "scp", "SphyxOS/extras/nsProxy.js", "home") //Doesn't need to be awaited, but it lets me specify threads without more work
    if (!globalThis["SphyxOSDarknetWebWorkers"]) globalThis["SphyxOSDarknetWebWorkers"] = []
  }
  //We started with the wrong module somehow.  Just exit.
  try { complete.get("darkweb").pw }
  catch { return }

  while (ns.dnet.getBlockedRam(me) > 0 && await proxyHome(ns, "getServerMaxRam", me) - await proxyHome(ns, "getServerUsedRam", me) < reservedRam) {
    if (!await threadedMemoryRealloc(ns, me, complete.get(me).pw)) break
  }
  await startup(ns) //Select the easiest ones to get into first, then go from there.
  while (true) {
    const serversRaw = await proxyLocal(ns, 1, "dnet.probe")
    const serverArray = []
    for (const server of serversRaw)
      serverArray.push({ name: server.toString(), modelId: ns.dnet.getServerDetails(server), cha: await proxyLocal(ns, 1, "dnet.getServerRequiredCharismaLevel", server) })
    serverArray.sort((a, b) => a.cha - b.cha)
    const servers = priorityArraySort(serverArray) //Sorts based on ease of hacking.
    const files = await proxyLocal(ns, 1, "ls", me)
    const cacheFiles = files.filter((f) => f.endsWith(".cache"))
    if (cacheFiles.length > 0)
      for (const file of cacheFiles)
        await proxyLocal(ns, 1, "dnet.openCache", file, true)
    if (modeStorm) {
      const stormFiles = files.filter((f) => f.endsWith(".exe"))
      if (stormFiles.length > 0) {
        await proxyLocal(ns, 1, "dnet.unleashStormSeed")
        ns.writePort(1, "darknet storm off")
        modeStorm = false
      }
    }
    const dataFiles = files.filter((f) => f.endsWith(".data.txt"))
    dataFiles.forEach((f) => {
      const content = ns.read(f)
      if (content.startsWith("Server:")) {//We have a new password to take and use  What about names with spaces?
        const splitContent = content.split(" ")
        splitContent.shift() //Good by Server:
        const server = splitContent.shift()
        splitContent.shift() //Good by Password:
        const password = splitContent.join(" ").replaceAll("\"", "").toString()
        updateFull(server, password, ns.dnet.getServerDetails(server))
        ns.mv(me, f, f.replaceAll("data", "processed"))
      }
      else ns.mv(me, f, f.replaceAll("data", "processed"))
    })
    const litFiles = await proxyLocal(ns, 1, "ls", me, ".lit")
    for (const file of litFiles)
      await proxyAuth(ns, 1, me, complete.get(me).pw, "rm", file)
    let foundWork = false
    for (const serverRaw of servers) {
      const server = serverRaw.toString()
      if (workingOn.has(server)) continue
      let details = ns.dnet.getServerDetails(server)
      if (!details.isConnectedToCurrentServer) continue
      if (ns.dnet.getStasisLinkedServers().includes(ns.self().server) && details.modelId !== "(The Labyrinth)") continue
      let result
      if (!details.hasSession) {
        updateWorkingOn(server, details, "set")
        ns.atExit(() => {
          updateWorkingOn(server, details, "remove")
        })
        result = await breakIn(ns, server, details)
        updateWorkingOn(server, details, "remove")
        ns.atExit(() => { })
        if (result.success) foundWork = true
        if (result?.silentFail) {
          return
        }
      }
      else result = { success: true }
      details = ns.dnet.getServerDetails(server)
      if (details.hasSession) {
        while (me !== "home" && details.isConnectedToCurrentServer && details.hasSession && ns.dnet.getBlockedRam(server) > 0 && await proxyLocal(ns, 1, "getServerMaxRam", server) - await proxyLocal(ns, 1, "getServerUsedRam", server) - minResRam < ns.self().ramUsage) {
          if (!await threadedMemoryRealloc(ns, server, complete.get(server).pw, server)) break
          details = ns.dnet.getServerDetails(server)
        }
        details = ns.dnet.getServerDetails(server)
        if (details.isConnectedToCurrentServer && details.hasSession) {
          const runningScripts = await proxyLocal(ns, 1, "ps", server)
          if (details.isConnectedToCurrentServer && details.hasSession && runningScripts?.length === 0) {
            await proxyAuth(ns, 1, server, complete.get(server).pw, "scp", ns.self().filename, server, "home")
            const threads = Math.floor((await proxyLocal(ns, 1, "getServerMaxRam", server) - await proxyLocal(ns, 1, "getServerUsedRam", server) - minResRam) / ns.self().ramUsage)
            if (threads) ns.exec(ns.self().filename, server, { threads: 1, preventDuplicates: true })
          }
        }
      }
      await startup(ns)
    }

    if (ns.dnet.getStasisLinkedServers().includes(ns.self().server)) {
      if (await proxyHome(ns, "getServerMaxRam", ns.self().server) - await proxyHome(ns, "getServerUsedRam", ns.self().server) >= 13.6)
        await proxyLocal(ns, true, "dnet.setStasisLink", false)
      else {
        ns.ramOverride(16)
        await ns.dnet.setStasisLink(false)
        ns.exit()
      }
    }
    if (!foundWork) {
      const servers = await proxyLocal(ns, 1, "dnet.probe")
      for (const serverRaw of servers) {
        const server = serverRaw.toString()
        let details = ns.dnet.getServerDetails(server)
        if (details.hasSession && details.isConnectedToCurrentServer) {
          const runningScripts = await proxyAuth(ns, 1, server, complete.get(server).pw, "ps", server)
          if (runningScripts?.length === 0) {
            await proxyAuth(ns, 1, server, complete.get(server).pw, "scp", ns.self().filename, server, "home")
            let threads = 0
            while (!threads && ns.dnet.getBlockedRam(server) > 0) {
              await threadedMemoryRealloc(ns, server, complete.get(server).pw)
              threads = Math.floor((await proxyLocal(ns, 1, "getServerMaxRam", server) - await proxyLocal(ns, 1, "getServerUsedRam", server) - minResRam) / ns.self().ramUsage)
            }
            if (threads) ns.exec(ns.self().filename, server, { threads: 1, preventDuplicates: true })
          }
          if (ns.dnet.getBlockedRam(server) > 0) {
            await threadedMemoryRealloc(ns, server, complete.get(server).pw)
          }
        }
      }
      if (modePhishing && ns.dnet.getBlockedRam(me) === 0) await proxyLocal(ns, true, "dnet.phishingAttack")
      if (modeInduce && ns.dnet.getBlockedRam(me) === 0) {
        const pushTargets = await proxyLocal(ns, 1, "dnet.probe")
        let bestTarget = ""
        let bestRam = 0
        for (const serverRaw of pushTargets) {
          const server = serverRaw.toString()
          const details = ns.dnet.getServerDetails(server)
          if (server !== "darkweb" && details.modelId !== "(The Labyrinth)" && details.hasSession && details.isConnectedToCurrentServer && ns.dnet.getBlockedRam(server) === 0) {
            if (await proxyHome(ns, "getServerMaxRam", server) > bestRam) {
              bestTarget = server
              bestRam = await proxyHome(ns, "getServerMaxRam", server)
            }
          }
        }
        if (bestRam > 0) await proxyAuth(ns, true, bestTarget, complete.get(bestTarget).pw, "dnet.induceServerMigration", bestTarget)
      }
      if (modeShare && ns.dnet.getBlockedRam(me) === 0) await proxyLocal(ns, true, "share")
      if (modeStock !== "none" && ns.dnet.getBlockedRam(me) === 0) {
        for (const sym of modeStock)
          await proxyLocal(ns, true, "dnet.promoteStock", sym)
      }
    }
    if (ns.dnet.getBlockedRam(me) > 0) {
      await threadedMemoryRealloc(ns, me, complete.get(me).pw)
    }
    const ccts = await proxyLocal(ns, 1, "ls", me, ".cct")
    if (!workingOnCCT && ccts.length > 0) {
      workingOnCCT = true
      await runCCT(ns, me, "darknet", "quiet")
    }
    if (!modeInduce && !modePhishing && !modeShare && modeStock === "none" && !foundWork) await ns.asleep(200)
    if (me === "darkweb") {
      //ns.write(telemetryFile, JSON.stringify(telemetry), "w")
      for (const [server] of complete)
        try { if (!ns.dnet.getServerDetails(server).isOnline) complete.delete(server) }
        catch { complete.delete(server) }
      for (const [server] of inProgress)
        try { if (!ns.dnet.getServerDetails(server).isOnline) inProgress.delete(server) }
        catch { inProgress.delete(server) }

      ns.write(completeFile, JSON.stringify([...complete]), "w")
      ns.write(inProgFile, JSON.stringify([...inProgress]), "w")
      //await proxyLocal(ns, 1, "scp", telemetryFile, "home", me)      
    }
  }
}
function priorityArraySort(arr) {
  const prioritySet = new Set(easyHacks)
  const secondarySet = new Set(midHacks)
  const tertiarySet = new Set(hardHacks)
  const rank = (item) => {
    if (prioritySet.has(item)) return 0
    if (secondarySet.has(item)) return 1
    if (tertiarySet.has(item)) return 2
    return 3
  }
  return arr.slice().sort((a, b) => rank(a.modelId) - rank(b.modelId)).map((obj) => obj.name)
}
/** @param {NS} ns */
async function startup(ns) {
  const servers = await proxyLocal(ns, 1, "dnet.probe")
  for (const serverRaw of servers) {
    const server = serverRaw.toString()
    if (workingOn.has(server)) continue
    let details = ns.dnet.getServerDetails(server)
    if (complete.has(server) && details.isConnectedToCurrentServer) { //Help is on the way!
      const result = ns.dnet.connectToSession(server, complete.get(server).pw)
      if (!result.success) {
        if (!validate(ns, server, complete.get(server).details)) complete.delete(server)
        continue
      }
      details = ns.dnet.getServerDetails(server)
      if (details.hasSession && details.isConnectedToCurrentServer) {
        const runningScripts = await proxyLocal(ns, 1, "ps", server)
        if (details.isConnectedToCurrentServer && details.hasSession && await proxyLocal(ns, 1, "getServerMaxRam", server) - await proxyLocal(ns, 1, "getServerUsedRam", server) - minResRam > ns.self().ramUsage && runningScripts?.length === 0) {
          await proxyAuth(ns, 1, server, complete.get(server).pw, "scp", ns.self().filename, server, "home")
          const threads = Math.floor((await proxyLocal(ns, 1, "getServerMaxRam", server) - await proxyLocal(ns, 1, "getServerUsedRam", server) - minResRam) / ns.self().ramUsage)
          if (threads) ns.exec(ns.self().filename, server, { threads: 1, preventDuplicates: true })
        }
      }
    }
  }
}
/**
 * @param {ServerAuthDetails} details
 * @param {NS} ns
**/
async function breakIn(ns, server, details) {
  if (server === "darkweb") return { success: true }
  if (complete.has(server)) {
    let result = ns.dnet.connectToSession(server, complete.get(server).pw)
    if (result.success) return result
    else complete.delete(server)
  }
  let tries = 1
  const player = await proxyLocal(ns, 1, "getPlayer")
  const chaReq = await proxyLocal(ns, 1, "dnet.getServerRequiredCharismaLevel", server)
  await validateProgress(ns, server, details)
  switch (details.modelId) {
    case "DeskMemo_3.1": {
      const answerArray = details.passwordHint.split(" ")
      const answer = answerArray[answerArray.length - 1]
      const result = await goToWork(ns, server, answer.toString(), tries++, details)
      if (result.success || !serverCheck(ns, server, details, result)) return result
      failureReport(ns, server, details)
      return result
    }
    case "ZeroLogon": {
      const result = await goToWork(ns, server, "", tries++, details)
      if (result.success || !serverCheck(ns, server, details, result)) return result
      failureReport(ns, server, details)
      return result
    }
    case "FreshInstall_1.0": {
      let result = false
      if (details.passwordFormat === "alphabetic") {
        if (details.passwordLength === 5) result = await goToWork(ns, server, "admin", tries++, details)
        else if (details.passwordLength === 8) result = await goToWork(ns, server, "password", tries++, details)
      }
      else if (details.passwordFormat === "numeric") {
        if (details.passwordLength === 5) result = await goToWork(ns, server, "12345", tries++, details)
        else if (details.passwordLength === 4) result = await goToWork(ns, server, "0000", tries++, details)
      }
      if (result && (result.success || !serverCheck(ns, server, details, result))) return result
      failureReport(ns, server, details)
      return { success: false }
    }
    case "CloudBlare(tm)": {
      const result = await goToWork(ns, server, details.data.replace(/\D/g, "").toString(), tries++, details)
      if (result.success || !serverCheck(ns, server, details, result)) return result
      failureReport(ns, server, details)
      return result
    }
    case "Laika4": {
      if (details.passwordLength === 3) return await goToWork(ns, server, "max", tries++, details)
      else if (details.passwordLength === 5) return await goToWork(ns, server, "rover", tries++, details)
      else if (details.passwordLength === 4) {
        let result = await goToWork(ns, server, "fido", tries++, details)
        if (result.success || !serverCheck(ns, server, details, result)) return result
        else {
          result = await goToWork(ns, server, "spot", tries++, details)
          if (result.success || !serverCheck(ns, server, details, result)) return result
        }
      }
      failureReport(ns, server, details)
      return { success: false }
    }
    case "BellaCuore": {
      let rawNumbers = details.data.split(",")
      const numbers = []
      if (rawNumbers.length > 1)
        rawNumbers.forEach((n) => numbers.push(romanToDecimal(n)))
      else numbers.push(romanToDecimal(rawNumbers[0]))
      let result
      if (numbers.length === 1) {
        result = await goToWork(ns, server, numbers[0].toString(), tries++, details)
        if (result.success || !serverCheck(ns, server, details, result)) return result
      }
      else { //We have a range of 2 numbers.
        let pool = inProgress.get(server)?.currentPool ?? []
        tries = inProgress.get(server)?.tries ?? 1
        const high = numbers[0] > numbers[1] ? numbers[0] : numbers[1]
        const low = numbers[0] < numbers[1] ? numbers[0] : numbers[1]
        if (pool.length === 0) {
          for (let i = low; i <= high; i++)
            if (i.toString().length === details.passwordLength) pool.push(i)
        }
        let maxTotalThreads = await getMaxAuthThreads(ns, true)
        if (maxTotalThreads < 2) return { success: false }
        while (true) {

          inProgress.set(server, {
            details: details,
            currentPool: pool.slice(),
            tries: tries
          })
          const testing = pool[Math.floor(pool.length / 2)]
          let bleed
          let running = 1
          goToWork(ns, server, testing.toString(), tries++, details, Math.floor(maxTotalThreads / 2)).then((results) => {
            running--
            result = results
          })
          running++
          bleedGrab(ns, server, 999, Math.floor(maxTotalThreads / 2)).then((bleedRaw) => {
            running--
            bleed = bleedRaw
          })
          while (running) await ns.asleep(4)
          if (result.success || !await bleedCheck(ns, server, details, bleed)) return result
          for (const log of bleed.logs) {
            let jsonLog
            try { jsonLog = JSON.parse(log) } catch { continue }
            if (jsonLog?.passwordAttempted.toString() !== testing.toString()) continue
            if (jsonLog.data.toString() === "PARUM BREVIS")
              pool = pool.filter((p) => p > testing)
            else if (jsonLog.data.toString() === "ALTUS NIMIS")
              pool = pool.filter((p) => p < testing)
            break
          }
        }
      }
      failureReport(ns, server, details)
      return { success: false }
    }
    case "RateMyPix.Auth": {
      let testing
      if (details.passwordFormat === "numeric") testing = numbers
      else if (details.passwordFormat === "alphabetic") testing = lettersLCase.concat(lettersUCase)
      else testing = numbers.concat(lettersLCase).concat(lettersUCase)
      let worker //Our webworker
      let i = inProgress.get(server)?.count ?? 0
      tries = inProgress.get(server)?.tries ?? 1
      let knownPool = Array.from(inProgress.get(server)?.knownPool ?? [])
      let firstGuess = inProgress.get(server)?.firstGuess ?? false
      let lastGuess = Array.from(inProgress.get(server)?.lastGuess ?? [])
      let nextGuess = Array.from(inProgress.get(server)?.nextGuess ?? [])
      let pixCursor = Array.from(inProgress.get(server)?.pixCursor ?? [])
      const tested = new Set(inProgress.get(server)?.tested ?? [])
      const testFeedback = Array.from(inProgress.get(server)?.testFeedback ?? [])
      const record = () => {
        inProgress.set(server, {
          details: details,
          knownPool: knownPool.slice(),
          count: i,
          tries: tries,
          firstGuess: firstGuess,
          lastGuess: Array.isArray(lastGuess) ? lastGuess.slice() : [],
          nextGuess: Array.isArray(nextGuess) ? nextGuess.slice() : [],
          pixCursor: Array.isArray(pixCursor) ? pixCursor.slice() : [],
          tested: Array.from(tested),
          testFeedback: testFeedback.slice()
        })
      }
      const clearWorker = (dirty = false) => {
        if (!worker) return
        if (dirty) {
          if (!globalThis["SphyxOSDarknetWebWorkers"].includes(worker))
            globalThis["SphyxOSDarknetWebWorkers"].push(worker)
          worker = null
        }
        else {
          globalThis["SphyxOSDarknetWebWorkers"].push({ workerReady: worker })
          worker = null
        }
      }
      const isRateMyPixCandidateValid = (guess) => {
        if (!Array.isArray(guess) || guess.length !== details.passwordLength) return false
        const poolCounts = new Map()
        for (const value of knownPool) poolCounts.set(value, (poolCounts.get(value) ?? 0) + 1)
        for (const value of guess) {
          const count = poolCounts.get(value) ?? 0
          if (count <= 0) return false
          poolCounts.set(value, count - 1)
        }
        for (const count of poolCounts.values()) if (count !== 0) return false
        if (tested.has(guess.join(","))) return false
        for (const { guess: previousGuess, feedback } of testFeedback) {
          let blk = 0
          for (let x = 0; x < guess.length; x++) if (guess[x] === previousGuess[x]) blk++
          if (blk !== Number(feedback.blk)) return false
        }
        return true
      }
      const requestNextPixGuess = async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (!worker) worker = await getWorker(ns)
          let ready = false
          let response = { guess: false, cursor: pixCursor.slice(), checked: 0, exhausted: false }
          let failed = false
          const startedAt = Date.now()
          worker.onmessage = (msg) => {
            try {
              const rawResponse = msg.data[0]
              response = Array.isArray(rawResponse)
                ? { guess: rawResponse, cursor: rawResponse.slice(), checked: 0, exhausted: false }
                : rawResponse
            } catch { response = { guess: false, cursor: pixCursor.slice(), checked: 0, exhausted: false } }
            ready = true
          }
          worker.onerror = (event) => {
            event?.preventDefault?.()
            failed = true
            ready = true
          }
          worker.onmessageerror = () => {
            failed = true
            ready = true
          }
          worker.postMessage(["pixGetNextCode", [tested, testFeedback, lastGuess, knownPool, pixCursor, rateMyPixWorkerSearchMs],])

          while (!ready) {
            try { ns.self().server }
            catch {
              clearWorker(true)
              return { silentFail: true }
            }
            if (Date.now() - startedAt > rateMyPixWorkerStallMs) {
              clearWorker(true)
              if (attempt === 0) break
              return { stalled: true, nextGuess: false }
            }
            await ns.asleep(4)
          }
          if (!ready) continue
          clearWorker() //Send it back clean for reuse
          if (failed) {
            if (attempt === 0) continue
            return { failed: true, nextGuess: false }
          }
          return {
            nextGuess: response?.guess ?? false,
            cursor: Array.isArray(response?.cursor) ? response.cursor : pixCursor.slice(),
            checked: Number(response?.checked ?? 0),
            exhausted: Boolean(response?.exhausted),
            sawTestedCandidate: Boolean(response?.sawTestedCandidate)
          }
        }
        return { stalled: true, nextGuess: false }
      }
      function allEqual(str) {
        for (let i = 1; i < str.length; i++) {
          if (str[i] !== str[0]) {
            return false
          }
        }
        return true
      }
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 3) return { success: false }
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / 11))
      const processing = []
      let bleedResults
      let running = 0
      while (knownPool.length < details.passwordLength && i < testing.length) {
        const beingTested = player.skills.charisma < chaReq ? "[" : testing[i++]
        const testGroup = []
        for (let x = 0; x < details.passwordLength; x++)
          testGroup.push(beingTested)
        running++
        goToWork(ns, server, testGroup.join("").toString(), tries, details, maxThreads).then((results) => {
          running--
          processing.push(results)
        })
        if (i < testing.length && (running * maxThreads) + (maxThreads * 2) <= maxTotalThreads) continue //Saving 1 maxThreads for heartbleed
        running++
        bleedGrab(ns, server, 999, maxThreads).then((bleed) => { //Bleed takes longer than auth at the same threads
          running--
          bleedResults = bleed
        })
        while (running > 0) await ns.asleep(4)
        for (const results of processing)
          if (results.success) return results
        if (!await bleedCheck(ns, server, details, bleedResults)) return { success: false }
        for (const log of bleedResults.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog.passwordAttempted.toString().includes("[")) continue
          if (jsonLog.passwordAttempted.toString().length !== details.passwordLength) continue
          if (!allEqual(jsonLog.passwordAttempted.toString())) continue
          if (tested.has(jsonLog.passwordAttempted.toString())) continue
          tested.add(jsonLog.passwordAttempted.toString())
          const tried = jsonLog.passwordAttempted.split("")[0]
          const response = jsonLog.data.split("/")
          if (response[0].toString() !== "0") {
            const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" }) //At this point, we could just .replaceAll() the pepper with something else, but why?
            const currentMatch = Array.from(segmenter.segment(response[0])).length //Surprise!  Each 🌶️ splits into multiple unicode points, with variants...  Spicy indeed!!
            let index
            for (const test in testing)
              if (testing[test].toString() === tried.toString()) {
                index = Number(test)
                break
              }
            for (let x = 0; x < currentMatch; x++)
              knownPool.push(index)
          }
        }
        tries++
        record()
      }
      knownPool = knownPool.toSorted((a, b) => a - b)
      if (!firstGuess) {
        maxTotalThreads = await getMaxAuthThreads(ns, true)
        if (knownPool.length !== details.passwordLength) {
          failureReport(ns, server, details)
          return { success: false }
        }
        let result
        let running = 1
        goToWork(ns, server, knownPool.map((index) => testing[index]).join("").toString(), tries++, details, Math.floor(maxTotalThreads / 2)).then((resultRaw) => {
          running--
          result = resultRaw
        })
        running++
        let bleed
        bleedGrab(ns, server, 999, Math.floor(maxTotalThreads / 2)).then((bleedRaw) => {
          running--
          bleed = bleedRaw
        })
        while (running > 0) await ns.asleep(4)
        if (result.success) return result
        if (!await bleedCheck(ns, server, details, bleed)) return { success: false }
        let found = false
        for (const log of bleed.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog.passwordAttempted.toString() !== knownPool.map((index) => testing[index]).join("").toString()) continue
          found = true
          const response = jsonLog.data.split("/")
          if (response[0].toString() === "0") {
            testFeedback.push({
              guess: knownPool.slice(),
              feedback: { blk: 0 },
              response: response
            })
          }
          else {
            //Segmenter is overkill.  You could just replaceAll instances of the pepper with something else
            const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            const currentMatch = Array.from(segmenter.segment(response[0])).length //Surprise!  Each 🌶️ splits into multiple unicode points, with variants...  Spicy indeed!!
            testFeedback.push({
              guess: knownPool.slice(),
              feedback: { blk: currentMatch },
              response: response
            })
          }
          tested.add(knownPool.join(","))
          firstGuess = true
          lastGuess = knownPool.slice()
          nextGuess = []
          pixCursor = lastGuess.slice()
          record()
          break
        }
        if (!found) {
          clearWorker()
          failureReport(ns, server, details)
          return { success: false }
        }
      }
      //webworker time!
      ns.atExit(() => {
        clearWorker(true)
        updateWorkingOn(server, details, "remove")
      })
      let pixNoProgressCycles = 0
      while (true) {
        maxTotalThreads = await getMaxAuthThreads(ns, true)
        if (nextGuess.length === 0) {
          const previousPixCursor = Array.isArray(pixCursor) ? pixCursor.slice() : []
          const workerResult = await requestNextPixGuess()
          if (workerResult.silentFail) {
            return { silentFail: true }
          }
          if (Array.isArray(workerResult.cursor)) pixCursor = workerResult.cursor.slice()
          nextGuess = Array.isArray(workerResult.nextGuess) ? workerResult.nextGuess.slice() : []
          record()
          if (workerResult.stalled || workerResult.failed) {
            failureReport(ns, server, details)
            clearWorker()
            return { success: false }
          }
          if (workerResult.exhausted) {
            failureReport(ns, server, details)
            clearWorker()
            return { success: false }
          }
          if (!nextGuess || nextGuess.length === 0) {
            const cursorAdvanced = Array.isArray(pixCursor)
              && pixCursor.length > 0
              && pixCursor.join(",") !== previousPixCursor.join(",")
            if (!cursorAdvanced) {
              pixNoProgressCycles++
              clearWorker()
              if (pixNoProgressCycles < 2) continue
              failureReport(ns, server, details)
              clearWorker()
              return { success: false }
            }
            pixNoProgressCycles = 0
            continue
          }
        }
        pixNoProgressCycles = 0
        if (!nextGuess || nextGuess.length === 0) {
          failureReport(ns, server, details)
          clearWorker()
          return { success: false }
        }
        if (!isRateMyPixCandidateValid(nextGuess)) {
          failureReport(ns, server, details)
          clearWorker()
          return { success: false }
        }
        let result
        let running = 1
        goToWork(ns, server, nextGuess.map((index) => testing[index]).join("").toString(), tries++, details, Math.floor(maxTotalThreads / 2)).then((resultRaw) => {
          running--
          result = resultRaw
        })
        let bleed
        running++
        bleedGrab(ns, server, 999, Math.floor(maxTotalThreads / 2)).then((bleedRaw) => {
          running--
          bleed = bleedRaw
        })
        while (running > 0) await ns.asleep(4)

        if (result.success) {
          clearWorker()
          return result
        }
        if (!await bleedCheck(ns, server, details, bleed)) {
          clearWorker()
          return { success: false }
        }
        let found = false
        for (const log of bleed.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog?.passwordAttempted.toString() !== nextGuess.map((index) => testing[index]).join("").toString()) continue
          found = true
          const response = jsonLog.data.split("/")

          if (response[0].toString() === "0") {
            testFeedback.push({
              guess: nextGuess.slice(),
              feedback: { blk: 0 },
              response: response
            })
          }
          else {
            const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            const currentMatch = Array.from(segmenter.segment(response[0])).length
            testFeedback.push({
              guess: nextGuess.slice(),
              feedback: { blk: currentMatch },
              response: response
            })
          }
          tested.add(nextGuess.join(","))
          lastGuess = nextGuess.slice()
          nextGuess = []
          pixCursor = lastGuess.slice()
          record()
          break
        }
        if (!found) {
          clearWorker()
          failureReport(ns, server, details)
          return { success: false }
        }
      }
    }
    case "OctantVoxel": {
      const nums = details.data.split(",")
      const result = await goToWork(ns, server, convertToBase10([nums[1], nums[0]]).toString(), tries++, details)
      if (result.success || !serverCheck(ns, server, details, result)) return result
      failureReport(ns, server, details)
      return result
    }

    case "BigMo%od": {
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 2) return { success: false }
      let worker
      const length = details.passwordLength
      const MIN = 10 ** (length - 1)
      const MAX = 10 ** length - 1
      let tries = inProgress.get(server)?.tries ?? 1
      let tripleConstraints = inProgress.get(server)?.tripleConstraints ?? []
      let nextGuess = inProgress.get(server)?.nextGuess ?? ""
      let lastGuess = inProgress.get(server)?.lastGuess ?? 0

      const tried = new Set(inProgress.get(server)?.tried ?? [])
      const record = () => {
        inProgress.set(server, {
          details: details,
          nextGuess: nextGuess,
          lastGuess: lastGuess,
          tries: tries,
          tripleConstraints: tripleConstraints.slice(),
          tried: Array.from(tried)
        })
      }
      const clearWorker = (dirty = false) => {
        if (!worker) return
        if (dirty) {
          if (!globalThis["SphyxOSDarknetWebWorkers"].includes(worker))
            globalThis["SphyxOSDarknetWebWorkers"].push(worker)
          worker = null
        }
        else {
          globalThis["SphyxOSDarknetWebWorkers"].push({ workerReady: worker })
          worker = null
        }
      }

      function parseTripleModuloLogs(logs, candidate) {
        const out = []
        for (const log of logs ?? []) {
          try {
            const j = JSON.parse(log)
            if (j?.passwordAttempted.toString() === candidate) {
              const k = Number(j.passwordAttempted)
              const r = Number(j.data)
              if (Number.isFinite(k) && Number.isFinite(r)) {
                out.push({ k, r })
              }
            }
          } catch {
            continue
          }
        }
        return out
      }
      ns.atExit(() => {
        clearWorker(true)
        updateWorkingOn(server, details, "remove")
      })
      while (true) {

        maxTotalThreads = await getMaxAuthThreads(ns, true)
        record()
        if (nextGuess === "") {
          let ready = false
          worker = await getWorker(ns)
          worker.onmessage = (msg) => {
            try { nextGuess = msg.data[0] } catch { nextGuess = false }
            ready = true
            record()
          }
          worker.postMessage(["getNextCandidate", [lastGuess, tripleConstraints, tries, MIN, MAX, tried]])
          while (!ready) await ns.asleep(4)
          clearWorker()
          try { ns.self().server }
          catch {
            return { silentFail: true }
          }
          if (!nextGuess) {
            failureReport(ns, server, details)
            return { success: false }
          }
        }
        let result
        let bleed
        let running = 1
        goToWork(ns, server, nextGuess.toString(), tries++, details, Math.floor(maxTotalThreads / 2)).then((results) => {
          running--
          result = results
        })
        running++
        bleedGrab(ns, server, 999, Math.floor(maxTotalThreads / 2)).then((bleedRaw) => {
          running--
          bleed = bleedRaw
        })
        while (running) await ns.asleep(4)
        if (result.success || !await bleedCheck(ns, server, details, bleed)) {
          clearWorker()
          return result
        }
        let found = false
        for (const log of bleed.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog?.passwordAttempted.toString() !== nextGuess.toString()) continue
          found = true
          break
        }
        if (!found) continue
        const fresh = parseTripleModuloLogs(bleed.logs, nextGuess.toString()).filter(c => !tripleConstraints.some(x => x.k === c.k && x.r === c.r))
        if (fresh.length > 0) tripleConstraints.push(...fresh)
        tried.add(nextGuess)
        lastGuess = Number(nextGuess)
        nextGuess = ""
      }
    }
    case "Factori-Os": {
      tries = inProgress.get(server)?.tries ?? 1
      let primeCounter = inProgress.get(server)?.primeCounter ?? 0
      const primeMap = new Map(inProgress.get(server)?.primeMap || [])
      const processed = new Set(inProgress.get(server)?.processed || [])
      const primes = inProgress.get(server)?.primes || []
      const record = () => inProgress.set(server, {
        details: details,
        primeCounter: primeCounter,
        primeMap: Array.from(primeMap),
        processed: Array.from(processed),
        primes: primes,
        tries: tries
      })

      if (details.passwordLength === 1) { //Seperate optimal solver
        const testingOrder = [0, 7, 2, 3, 6, 5, 4, 8, 9]
        let candidates = inProgress.get(server)?.candidates ?? [1, 2, 3, 4, 5, 6, 7, 8, 9]
        let maxTotalThreads = await getMaxAuthThreads(ns, true)
        while (primeCounter < testingOrder.length) {
          maxTotalThreads = await getMaxAuthThreads(ns, true)
          record()
          const d = BigInt(testingOrder[primeCounter])
          if (candidates.length === 1) {
            const result = await goToWork(ns, server, candidates[0].toString(), tries++, details)
            if (result.success || !serverCheck(ns, server, details, result)) return result
            failureReport(ns, server, details)
            return { success: false }
          }
          else {
            let divides = false
            const maxThreads = d.toString() === "0" ? maxTotalThreads : Math.floor(maxTotalThreads / 2)
            let running = 1
            let result
            let bleed
            goToWork(ns, server, d.toString(), tries++, details, maxThreads).then((results) => {
              running--
              result = results
            })

            if (d.toString() !== "0") {
              running++
              bleedGrab(ns, server, 999, maxThreads).then((bleedRaw) => {
                running--
                bleed = bleedRaw
              })
            }
            while (running) await ns.asleep(4)
            if (result.success || !serverCheck(ns, server, details, result)) return result
            if (d.toString() !== "0") {
              if (!await bleedCheck(ns, server, details, bleed)) return { success: false }
              for (const log of bleed.logs) {
                let jsonLog
                try { jsonLog = JSON.parse(log) } catch { continue }
                if (jsonLog?.passwordAttempted.toString() !== d.toString()) continue
                if (jsonLog.data === "true")
                  divides = true
                break
              }
              candidates = candidates.filter(n => divides ? BigInt(n) % d === 0n : BigInt(n) % d !== 0n)
            }
            primeCounter++
          }
        }
        record()
        if (candidates.length === 1) {
          const result = await goToWork(ns, server, candidates[0].toString(), tries++, details)
          if (result.success || !serverCheck(ns, server, details, result)) return result
        }
        failureReport(ns, server, details)
        return { success: false }
      }
      const sortedPrimeGroup = [...smallPrimes, ...largePrimes].filter(p => (p).toString().length <= details.passwordLength)
      const sortedBigIntPrimes = sortedPrimeGroup.map(BigInt)
      if (primeMap.size === 0)
        sortedPrimeGroup.forEach((p) => primeMap.set(p.toString(), true))
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 3) return { success: false }
      let left = 0
      let firstGuess = true
      let base = BigInt(primes.reduce((acc, val) => acc * val, 1))
      if (base.toString().length === details.passwordLength) firstGuess = false //Only start this guess if it could work
      left = firstGuess ? 1 : 2 //We might make a guess against our base now.
      for (const [key, entry] of primeMap.entries())
        if (entry && (BigInt(key) * base).toString().length <= details.passwordLength)
          left++
      if (details.passwordLength < 4 && maxTotalThreads / 6 >= 2) left = left > 6 ? 6 : left
      else if (details.passwordLength >= 4 && maxTotalThreads / 13 >= 2) left = left > 13 ? 13 : left
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / left))
      let running = 0
      let processing = []
      let bleedResults
      while (primeMap.size) {
        if (!firstGuess) {
          firstGuess = true
          running++
          goToWork(ns, server, base.toString(), tries, details, maxThreads).then((results) => {
            running--
            processing.push(results)
          })
        }
        else {
          const prime = BigInt(sortedPrimeGroup[primeCounter++])
          const candidate = prime * base
          if (primeMap.get(prime.toString()) && candidate.toString().length <= details.passwordLength) {
            running++
            goToWork(ns, server, candidate.toString(), tries, details, maxThreads).then((results) => {
              running--
              processing.push(results)
            })
          }
        }
        if (primeCounter < sortedPrimeGroup.length && (running * maxThreads) + (maxThreads * 2) <= maxTotalThreads) continue //Saving 1 maxThreads for heartbleed
        running++
        bleedGrab(ns, server, 999, maxThreads).then((bleed) => { //Bleed takes longer than auth at the same threads
          running--
          bleedResults = bleed
        })
        while (running > 0) await ns.asleep(4)
        for (const results of processing)
          if (results.success) {
            return results
          }
        if (!await bleedCheck(ns, server, details, bleedResults)) return { success: false }
        const newPrimes = []
        for (const log of bleedResults.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          const attempted = BigInt(jsonLog.passwordAttempted)
          if (attempted.toString() === base.toString()) {
            continue
          }
          if (processed.has(attempted.toString())) {
            continue
          }
          const tested = attempted / base
          let basePrime = 0
          for (const prime of sortedBigIntPrimes)
            if (tested % prime === 0n) {
              basePrime = Number(prime)
              break
            }
          if (jsonLog.data === "true") {
            newPrimes.push(basePrime)
          }
          else {
            primeMap.delete(basePrime.toString())
          }
          processed.add(attempted.toString())
        }
        primes.push(...newPrimes)
        primeCounter = 0
        tries++
        processing = []
        bleedResults = []
        base = BigInt(primes.reduce((acc, val) => acc * val, 1))
        if (base.toString().length === details.passwordLength) firstGuess = false //Only start this guess if it could work
        left = firstGuess ? 1 : 2
        for (const [key, entry] of primeMap.entries())
          if (entry && (Number(key) * Number(base)).toString().length <= details.passwordLength)
            left++
        const newMax = await getMaxAuthThreads(ns, true)
        if (newMax > maxTotalThreads) {
          maxTotalThreads = newMax
          maxThreads = Math.max(1, Math.floor(maxTotalThreads / left))
        }
        if (details.passwordLength < 4 && maxTotalThreads / 6 >= 2) left = left > 6 ? 6 : left
        else if (details.passwordLength >= 4 && maxTotalThreads / 13 >= 2) left = left > 13 ? 13 : left
        record()
      }
      failureReport(ns, server, details)
      return { success: false }
    }
    case "AccountsManager_4.2": {
      const numbers = details.passwordHint.match(/\d+/g).map(Number)
      let pool = inProgress.get(server)?.pool ?? []
      tries = inProgress.get(server)?.tries ?? 1

      if (pool.length === 0) {
        for (let i = numbers[0]; i <= numbers[1]; i++)
          if (i.toString().length === details.passwordLength) pool.push(i)
      }
      const record = () => inProgress.set(server, {
        details: details,
        pool: pool.slice(),
        tries: tries
      })
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 2) return { success: false }
      while (pool.length > 0) {
        const maxThreads = Math.floor(maxTotalThreads / 2)
        record()
        const testing = pool[Math.floor(pool.length / 2)]
        let result
        let bleed
        let running = 1
        goToWork(ns, server, testing.toString(), tries++, details, maxThreads).then((results) => {
          running--
          result = results
        })
        running++
        bleedGrab(ns, server, 999, maxThreads).then((bleedRaw) => {
          running--
          bleed = bleedRaw
        })
        while (running) await ns.asleep(4)
        if (result.success || !await bleedCheck(ns, server, details, bleed)) return result
        for (const log of bleed.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog?.passwordAttempted.toString() !== testing.toString()) continue
          if (jsonLog.data === "Lower") {
            const newPool = pool.filter((p) => p < Number(testing))
            pool = newPool
          }
          else if (jsonLog.data === "Higher") {
            const newPool = pool.filter((p) => p > Number(testing))
            pool = newPool
          }
          break
        }
      }
      failureReport(ns, server, details)
      return { success: false }
    }
    case "OpenWebAccessPoint": {
      tries = inProgress.get(server)?.tries ?? 1
      let pool = new Set(inProgress.get(server)?.pool ?? [])
      function record() {
        inProgress.set(server, {
          details: details,
          tries: tries,
          pool: Array.from(pool)
        })
      }
      function extractPassword(str, hostname, length) {
        const escaped = hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = `(?:^|\\s)${escaped}:(.{${length}})(?=\\s|$)`
        const regex = new RegExp(pattern)
        const match = regex.exec(str)
        return match ? match[1].toString() : null
      }
      function collectSegments(str, len = details.passwordLength, pwFormat = details.passwordFormat) {
        const out = new Set()
        //if (str.includes(" ")) return []
        for (let i = 0; i <= str.length - len; i++) {
          const test = str.slice(i, i + len)
          if (pwFormat === "numeric" && isNumeric(test)) out.add(test)
          else if (pwFormat === "alphabetic" && isAlphabetic(test)) out.add(test)
          else if (pwFormat === "alphanumeric" && isAlphanumeric(test)) out.add(test)
        }
        return Array.from(out)
      }
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 2) return { success: false }
      let running = 0
      if (pool.size === 0) {
        running++
        goToWork(ns, server, "", tries++, details, Math.floor(maxTotalThreads / 2)).then(() => {
          running--
        })
        let bleed
        running++
        bleedGrab(ns, server, 999, Math.floor(maxTotalThreads / 2)).then((bleedRaw) => {
          bleed = bleedRaw
          running--
        })
        while (running > 0) await ns.asleep(4)
        if (!await bleedCheck(ns, server, details, bleed)) return { success: false }
        let answer
        for (const log of bleed.logs) {
          answer = extractPassword(log, server, details.passwordLength)
          if (log.includes("There's definitely nothing in that password...")) answer = ""
          if (answer != null) break
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (!jsonLog?.data) continue
          const segments = collectSegments(jsonLog.data)
          segments.forEach((s) => pool.add(s))
        }
        if (answer != null) {
          const result = await goToWork(ns, server, answer.toString(), tries++, details)
          if (result.success || !serverCheck(ns, server, details, result)) return result
          else {
            failureReport(ns, server, details)
            return result
          }
        }
        record()
      }
      running = 0
      maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 4) return { success: false }
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / 4))
      while (pool.size > 0) {
        running++
        goToWork(ns, server, "", tries, details, maxThreads).then(() => {
          running--
        })
        if ((running * maxThreads) + (maxThreads * 2) <= maxTotalThreads) continue
        let bleed
        running++
        bleedGrab(ns, server, 999, maxThreads).then((bleedRaw) => {
          bleed = bleedRaw
          running--
        })
        while (running > 0) await ns.asleep(4)
        if (!await bleedCheck(ns, server, details, bleed)) return { success: false }
        let answer
        for (const log of bleed.logs) {
          const testPool = new Set()
          answer = extractPassword(log, server, details.passwordLength)
          if (log.includes("There's definitely nothing in that password...")) answer = ""
          if (answer != null) break
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (!jsonLog?.data) continue
          const segments = collectSegments(jsonLog.data)
          segments.forEach((s) => { if (pool.has(s)) testPool.add(s) })
          pool = new Set(Array.from(testPool))
          if (pool.size === 1) break
        }
        if (answer != null) {
          const result = await goToWork(ns, server, answer.toString(), tries, details)
          if (result.success || !serverCheck(ns, server, details, result)) return result
          else {
            failureReport(ns, server, details)
            return result
          }
        }
        if (pool.size === 1) {
          const result = await goToWork(ns, server, pool.values().next().value, tries, details)
          if (result.success || !serverCheck(ns, server, details, result)) return result
          else {
            failureReport(ns, server, details)
            return result
          }
        }
        maxTotalThreads = await getMaxAuthThreads(ns, true)
        maxThreads = Math.max(1, Math.floor(maxTotalThreads / 4))
        tries++
        record()
      }
      failureReport(ns, server, details)
      return { success: false }
    }
    case "NIL": {
      const length = details.passwordLength
      let testing
      if (details.passwordFormat === "numeric") testing = numbers
      else if (details.passwordFormat === "alphabetic") testing = lettersLCase.concat(lettersUCase)
      else testing = lettersLCase.concat(lettersUCase).concat(numbers)
      let i = inProgress.get(server)?.count ?? 0
      tries = inProgress.get(server)?.tries ?? 1
      const correct = inProgress.get(server)?.correct ?? []
      if (correct.length === 0)
        for (let check = 0; check < length; check++)
          correct.push("*")

      let running = 0
      let processing = []
      let bleedResults
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 3) return { success: false }
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / 11))
      while (i < testing.length) {
        //Slam it with blanks until we have the Cha to do it
        const beingTested = player.skills.charisma < chaReq ? "[" : testing[i++].toString()
        const testArray = correct.map((a) => a === "*" ? beingTested : a)
        running++
        goToWork(ns, server, testArray.join("").toString(), tries, details, maxThreads).then((results) => {
          running--
          processing.push(results)
        })
        if (i < testing.length && (running * maxThreads) + (maxThreads * 2) <= maxTotalThreads) continue
        running++
        bleedGrab(ns, server, 999, maxThreads).then((bleed) => {
          running--
          bleedResults = bleed
        })
        while (running > 0) await ns.asleep(4)
        for (const results of processing)
          if (results.success) return results
        if (!await bleedCheck(ns, server, details, bleedResults)) return { success: false }
        for (const log of bleedResults.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog.passwordAttempted.includes("[") || !jsonLog.data || jsonLog.data === "") continue
          if (jsonLog.passwordAttempted.toString().length !== details.passwordLength) continue
          const response = jsonLog.data.split(",")
          const pwAttempt = jsonLog.passwordAttempted.split("")
          for (let check = 0; check < response.length; check++) {
            if (response[check] === "yes") correct[check] = pwAttempt[check].toString()
          }
        }
        tries++
        if (correct.reduce((acc, val) => acc + (val === "*"), 0) === 0) {
          const results = await goToWork(ns, server, correct.join("").toString(), tries, details)
          if (results.success || !serverCheck(ns, server, details, results)) return results
          else {
            failureReport(ns, server, details)
            return { success: false }
          }
        }
        const newMax = await getMaxAuthThreads(ns, true)
        if (newMax > maxTotalThreads) {
          maxTotalThreads = newMax
          maxThreads = Math.max(1, Math.floor(maxTotalThreads / 11))
        }
        inProgress.set(server, {
          details: details,
          correct: correct,
          count: i
        })
      }
      failureReport(ns, server, details)
      return { success: false }
    }
    case "DeepGreen": {
      // A variation on Knuth
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 3) return { success: false }
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / 11))
      const testFeedback = inProgress.get(server)?.testFeedback ?? []
      const tested = new Set(inProgress.get(server)?.tested ?? [])
      tries = inProgress.get(server)?.tries ?? 1
      let firstFeedback
      let lastGuess = Array.from(inProgress.get(server)?.lastGuess ?? [])
      let nextGuess = Array.from(inProgress.get(server)?.nextGuess ?? [])
      let deepGreenCursor = Array.from(inProgress.get(server)?.deepGreenCursor ?? [])
      let currentTestRaw = inProgress.get(server)?.currentTestRaw ?? 0
      let i = inProgress.get(server)?.count ?? 0
      let countHasCycled = inProgress.get(server)?.countHasCycled ?? false
      let feedback
      let pool
      let worker
      if (details.passwordFormat === "numeric") pool = numbers
      else if (details.passwordFormat === "alphanumeric") pool = numbers.concat(lettersLCase).concat(lettersUCase)
      else pool = lettersLCase.concat(lettersUCase)
      const record = () => inProgress.set(server, {
        details: details,
        count: i,
        currentTestRaw: currentTestRaw,
        testFeedback: testFeedback.slice(),
        tested: Array.from(tested),
        lastGuess: lastGuess.slice(),
        nextGuess: nextGuess.slice(),
        deepGreenCursor: Array.isArray(deepGreenCursor) ? deepGreenCursor.slice() : [],
        tries,
        countHasCycled,
      })
      const clearWorker = (dirty = false) => {
        if (!worker) return
        if (dirty) {
          if (!globalThis["SphyxOSDarknetWebWorkers"].includes(worker))
            globalThis["SphyxOSDarknetWebWorkers"].push(worker)
          worker = null
        }
        else {
          globalThis["SphyxOSDarknetWebWorkers"].push({ workerReady: worker })
          worker = null
        }
      }
      const isDeepGreenCandidateValid = (guess) => {
        if (!Array.isArray(guess) || guess.length !== details.passwordLength) return false
        for (const value of guess) {
          if (!Number.isInteger(value) || value < 0 || value >= pool.length) return false
        }
        if (tested.has(guess.join(","))) return false
        for (const { guess: previousGuess, feedback } of testFeedback) {
          const expectedBlk = Number(feedback.blk)
          const expectedWht = Number(feedback.wht)
          let blk = 0
          const guessCount = new Map()
          const candidateCount = new Map()
          for (let x = 0; x < guess.length; x++) {
            if (guess[x] === previousGuess[x]) {
              blk++
            }
            else {
              guessCount.set(previousGuess[x], (guessCount.get(previousGuess[x]) ?? 0) + 1)
              candidateCount.set(guess[x], (candidateCount.get(guess[x]) ?? 0) + 1)
            }
          }
          let wht = 0
          for (const [value, count] of guessCount.entries()) {
            wht += Math.min(count, candidateCount.get(value) ?? 0)
          }
          if (blk !== expectedBlk || wht !== expectedWht) return false
        }
        return true
      }
      const requestNextDeepGreenGuess = async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
          let ready = false
          let response = { guess: false, cursor: deepGreenCursor.slice(), checked: 0, exhausted: false }
          let failed = false
          const startedAt = Date.now()
          if (!worker) worker = await getWorker(ns)
          worker.onmessage = (msg) => {
            try {
              const rawResponse = msg.data[0]
              response = Array.isArray(rawResponse)
                ? { guess: rawResponse, cursor: rawResponse.slice(), checked: 0, exhausted: false }
                : rawResponse
            } catch { response = { guess: false, cursor: deepGreenCursor.slice(), checked: 0, exhausted: false } }
            ready = true
          }
          worker.onerror = (event) => {
            event?.preventDefault?.()
            failed = true
            ready = true
          }
          worker.onmessageerror = () => {
            failed = true
            ready = true
          }
          try {
            worker.postMessage(["getNextCode", [tested, testFeedback, lastGuess, pool, deepGreenCursor, rateMyPixWorkerSearchMs]])
          }
          catch {
            failed = true
            ready = true
          }
          while (!ready) {
            try { ns.self().server }
            catch {
              clearWorker(true)
              return { silentFail: true }
            }
            if (Date.now() - startedAt > rateMyPixWorkerStallMs) {
              clearWorker(true)
              if (attempt === 0) break
              return { stalled: true, nextGuess: false }
            }
            await ns.asleep(4)
          }
          if (!ready) continue
          clearWorker()
          if (failed) {
            if (attempt === 0) continue
            return { failed: true, nextGuess: false }
          }
          return {
            nextGuess: response?.guess ?? false,
            cursor: Array.isArray(response?.cursor) ? response.cursor : deepGreenCursor.slice(),
            checked: Number(response?.checked ?? 0),
            exhausted: Boolean(response?.exhausted),
            sawTestedCandidate: Boolean(response?.sawTestedCandidate)
          }
        }
        return { stalled: true, nextGuess: false }
      }
      if (!countHasCycled) {
        maxTotalThreads = await getMaxAuthThreads(ns, true)
        maxThreads = Math.max(1, Math.floor(maxTotalThreads / 11))
        let processing = []
        let bleedResults
        let running = 0
        while (true) {
          const firstGuess = []
          for (let test = 0; test < details.passwordLength; test++) {
            firstGuess.push(currentTestRaw++)
            if (currentTestRaw === pool.length) {
              countHasCycled = true
              if (test === details.passwordLength) currentTestRaw = 1
              else currentTestRaw = 0
            }
          }
          running++
          goToWork(ns, server, firstGuess.map((index) => pool[index]).join("").toString(), tries, details, maxThreads).then((results) => {
            running--
            processing.push(results)
          })
          if ((running * maxThreads) + (maxThreads * 2) <= maxTotalThreads) continue
          running++
          bleedGrab(ns, server, 999, maxThreads).then((bleed) => {
            running--
            bleedResults = bleed
          })
          while (running > 0) await ns.asleep(4)
          for (const results of processing)
            if (results.success) return results
          if (!await bleedCheck(ns, server, details, bleedResults)) return { success: false }
          const checked = new Set()
          for (const log of bleedResults.logs) {
            let jsonLog
            try { jsonLog = JSON.parse(log) } catch { continue }
            if (jsonLog.passwordAttempted.toString().length !== details.passwordLength) continue
            if (jsonLog.passwordAttempted.toString() === "[") continue
            if (checked.has(jsonLog.passwordAttempted.toString())) continue
            if (!jsonLog?.data) continue
            checked.add(jsonLog.passwordAttempted.toString())
            const response = jsonLog.data.split(",")
            firstFeedback = {
              blk: Number(response[0]),
              wht: Number(response[1])
            }
            const convertedGuess = []
            for (const char of jsonLog.passwordAttempted.split("")) {
              for (const index in pool)
                if (pool[index].toString() === char.toString()) {
                  convertedGuess.push(Number(index))
                  break
                }
            }
            testFeedback.push({
              guess: [...convertedGuess],
              feedback: firstFeedback
            })
            tested.add(convertedGuess.join(","))
          }
          lastGuess = []
          for (let i = 0; i < details.passwordLength; i++)
            lastGuess.push(0)
          deepGreenCursor = lastGuess.slice()
          tries++
          processing = []
          bleedResults = undefined
          record()
          if (countHasCycled) break
          const newMax = await getMaxAuthThreads(ns, true)
          if (newMax > maxTotalThreads) {
            maxTotalThreads = newMax
            maxThreads = Math.max(1, Math.floor(maxTotalThreads / 11))
          }
        }
      }
      ns.atExit(() => {
        clearWorker(true)
        updateWorkingOn(server, details, "remove")
      })
      let deepGreenNoProgressCycles = 0
      while (true) {
        maxTotalThreads = await getMaxAuthThreads(ns, true)
        if (nextGuess.length === 0) {
          const previousDeepGreenCursor = Array.isArray(deepGreenCursor) ? deepGreenCursor.slice() : []
          const workerResult = await requestNextDeepGreenGuess()
          if (workerResult.silentFail) {
            return { silentFail: true }
          }
          if (Array.isArray(workerResult.cursor)) deepGreenCursor = workerResult.cursor.slice()
          nextGuess = Array.isArray(workerResult.nextGuess) ? workerResult.nextGuess.slice() : []
          record()
          if (workerResult.stalled || workerResult.failed) {
            failureReport(ns, server, details)
            clearWorker()
            return { success: false }
          }
          if (workerResult.exhausted) {
            failureReport(ns, server, details)
            clearWorker()
            return { success: false }
          }
          if (!nextGuess || nextGuess.length === 0) {
            const cursorAdvanced = Array.isArray(deepGreenCursor)
              && deepGreenCursor.length > 0
              && deepGreenCursor.join(",") !== previousDeepGreenCursor.join(",")
            if (!cursorAdvanced) {
              deepGreenNoProgressCycles++
              if (deepGreenNoProgressCycles < 2) continue
              clearWorker()
              failureReport(ns, server, details)
              return { success: false }
            }
            deepGreenNoProgressCycles = 0
            continue
          }
        }
        deepGreenNoProgressCycles = 0
        if (!isDeepGreenCandidateValid(nextGuess)) {
          failureReport(ns, server, details)
          clearWorker()
          return { success: false }
        }
        let result
        let running = 1
        goToWork(ns, server, nextGuess.map((index) => pool[index]).join("").toString(), tries++, details, Math.floor(maxTotalThreads / 2)).then((results) => {
          running--
          result = results
        })
        let bleed
        running++
        bleedGrab(ns, server, 999, Math.floor(maxTotalThreads / 2)).then((bleedRaw) => {
          running--
          bleed = bleedRaw
        })
        while (running) await ns.asleep(4)
        if (result.success) {
          clearWorker()
          return result
        }
        if (!await bleedCheck(ns, server, details, bleed)) {
          clearWorker()
          return { success: false }
        }
        let found = false
        for (const log of bleed.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog?.passwordAttempted.toString() !== nextGuess.map((index) => pool[index]).join("").toString()) continue
          found = true
          const response = jsonLog.data.split(",")
          feedback = {
            blk: Number(response[0]),
            wht: Number(response[1])
          }
          break //Only process 1 log at a time now
        }
        if (!found) continue
        testFeedback.push({
          guess: nextGuess.slice(),
          feedback: feedback
        })
        tested.add(nextGuess.join(","))

        lastGuess = nextGuess.slice()
        deepGreenCursor = lastGuess.slice()
        nextGuess = []
        record()
      }
    }
    case "Pr0verFl0": {
      const length = details.passwordLength
      let testing = []
      for (let i = 0; i < length * 2; i++)
        testing.push("1")
      const result = await goToWork(ns, server, testing.join("").toString(), tries++, details)
      if (result.success || !serverCheck(ns, server, details, result)) return result
      failureReport(ns, server, details)
      return result
    }
    case "PHP 5.4": {
      let worker
      const clearWorker = (dirty = false) => {
        if (!worker) return
        if (dirty) {
          if (!globalThis["SphyxOSDarknetWebWorkers"].includes(worker))
            globalThis["SphyxOSDarknetWebWorkers"].push(worker)
          worker = null
        }
        else {
          globalThis["SphyxOSDarknetWebWorkers"].push({ workerReady: worker })
          worker = null
        }
      }
      const testing = details.data.split("")
      tries = inProgress.get(server)?.tries ?? 1
      let nextGuess = inProgress.get(server)?.nextGuess ?? []
      const guessed = new Set(inProgress.get(server)?.guessed ?? [])
      const restraints = inProgress.get(server)?.restraints ?? []
      const record = () => inProgress.set(server, {
        details: details,
        tries: tries,
        nextGuess: nextGuess.slice(),
        guessed: Array.from(guessed),
        restraints: restraints.slice()
      })
      ns.atExit(() => {
        clearWorker(true)
        updateWorkingOn(server, details, "remove")
      })
      let maxTotalThreads = await getMaxAuthThreads(ns)
      let totalPermutations = Number(permutationCount(testing))
      let rate = totalPermutations > 10 ? 10 : totalPermutations
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / rate))
      if (details.passwordLength <= 4) {
        let running = 0
        let started = 0
        const processing = []
        while (true) {
          if (nextGuess.length === 0) {
            let ready = false
            worker = await getWorker(ns)
            worker.onmessage = (msg) => {
              try { nextGuess = msg.data[0] }
              catch {
                nextGuess = false
              }
              ready = true
              record()
            }
            worker.postMessage(["getNextUniquePermutation", [testing, guessed, restraints]])
            while (!ready) await ns.asleep(4)
            clearWorker()
            try { ns.self().server }
            catch {
              return { silentFail: true }
            }
            if (!nextGuess) {
              failureReport(ns, server, details)
              return { success: false }
            }
          }
          if (nextGuess && nextGuess.length > 0) {
            running++
            started++
            goToWork(ns, server, nextGuess.join("").toString(), tries, details, maxThreads).then((results) => {
              running--
              processing.push(results)
            })
            guessed.add(nextGuess.join(","))
            nextGuess = []
            if ((started * maxThreads) + maxThreads <= maxTotalThreads) continue
          }
          while (running > 0) await ns.asleep(4)
          for (const results of processing) {
            if (results.success) {
              clearWorker()
              return results
            }
          }
          if (!serverCheck(ns, server, details, processing[processing.length - 1])) {
            clearWorker()
            return { success: false }
          }
          tries++
          processing.length = 0
          started = 0
          const newMax = await getMaxAuthThreads(ns, true)
          if (newMax > maxTotalThreads) {
            maxTotalThreads = newMax
            totalPermutations = Number(permutationCount(testing))
            rate = totalPermutations > 10 ? 10 : totalPermutations
            maxThreads = Math.max(1, Math.floor(maxTotalThreads / rate))
          }
          record()
          if (!nextGuess) {
            failureReport(ns, server, details)
            return { success: false }
          }
        }
      }
      else {
        while (true) {
          const newMax = await getMaxAuthThreads(ns, true)
          if (newMax > maxTotalThreads) {
            maxTotalThreads = newMax
          }
          if (nextGuess.length === 0) {
            let ready = false
            worker = await getWorker(ns)
            worker.onmessage = (msg) => {
              try { nextGuess = msg.data[0] } catch { nextGuess = false }
              ready = true
              record()
            }
            worker.postMessage(["getNextUniquePermutation", [testing, guessed, restraints]])
            while (!ready) await ns.asleep(4)
            clearWorker()
            try { ns.self().server }
            catch {
              return { silentFail: true }
            }
          }
          if (!nextGuess || nextGuess.length === 0) break
          const result = await goToWork(ns, server, nextGuess.join("").toString(), tries++, details)
          if (result.success || !serverCheck(ns, server, details, result)) {
            clearWorker()
            return result
          }
          guessed.add(nextGuess.join(","))
          if (details.passwordLength >= 5) {
            const bleed = await bleedGrab(ns, server, 999)
            if (!await bleedCheck(ns, server, details, bleed)) {
              clearWorker()
              return { success: false }
            }
            for (const log of bleed.logs) {
              let jsonLog
              try { jsonLog = JSON.parse(log) } catch { continue }
              if (jsonLog?.passwordAttempted.toString() !== nextGuess.join("").toString()) continue
              const response = Number(jsonLog.data.split(":")[1])
              restraints.push({ guess: nextGuess.join("").toString(), rms: response })
              break
            }
          }
          nextGuess = []
        }
      }
      clearWorker()
      failureReport(ns, server, details)
      return { success: false }
    }
    case "110100100": {
      const values = details.data.split(" ")
      const answer = values.map(binary => String.fromCharCode(parseInt(binary, 2))).join('')
      const result = await goToWork(ns, server, answer.toString(), tries++, details)
      if (result.success || !serverCheck(ns, server, details, result)) return result
      failureReport(ns, server, details)
      return result
    }
    case "2G_cellular": {
      let testing
      if (details.passwordFormat === "numeric") testing = numbers
      else if (details.passwordFormat === "alphabetic") testing = lettersLCase.concat(lettersUCase)
      else testing = lettersLCase.concat(lettersUCase).concat(numbers)
      let i = inProgress.get(server)?.count ?? 0
      const correct = inProgress.get(server)?.correct ?? []
      tries = inProgress.get(server)?.tries ?? 1
      let totalDelay = inProgress.get(server)?.totalDelay ?? 0
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 3) return { success: false }
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / 11))
      let threadsFactor = 1 / (1 + 0.2 * (maxThreads - 1))
      let sharedCharsExtraTime = (correct.length + 1) * 50 * threadsFactor
      let running = 0
      let processing = []
      let extraTime = 10
      let testPool = new Set()
      const record = () => inProgress.set(server, {
        details: details,
        correct: correct.slice(),
        totalDelay: totalDelay,
        count: i,
        tries: tries
      })
      while (correct.length < details.passwordLength) {
        //Slam it with blanks until we have the Cha to do it
        const testChar = player.skills.charisma < chaReq ? "[" : testing[i++]
        const guess = correct.concat([testChar]).join("").toString()
        running++
        goToWork(ns, server, guess.toString(), tries, details, maxThreads).then((results) => {
          running--
          processing.push({ guess: guess.toString(), results: results })
        })
        testPool.add(testChar.toString())
        const mult = correct.length === details.passwordLength - 1 ? 1 : 2
        if (i < testing.length && (running * maxThreads) + (maxThreads * mult) <= maxTotalThreads) continue //Saving 1 maxThreads for heartbleed
        let bleed
        if (mult === 2) {
          running++
          totalDelay += Math.floor(sharedCharsExtraTime + extraTime + 0.5)
          bleedGrab(ns, server, 999, maxThreads, Math.ceil(sharedCharsExtraTime + extraTime)).then((bleedRaw) => { //Bleed takes longer than auth at the same threads
            running--
            bleed = bleedRaw
          })
        }
        while (running > 0) await ns.asleep(4)
        tries++
        if (mult === 1)
          for (const { guess, results } of processing) {
            if (results.success || !serverCheck(ns, server, details, results)) return results
            const status = results?.success ? "success" : (results?.message ?? "failed")
          }
        processing = []
        if (mult === 2) {
          if (!await bleedCheck(ns, server, details, bleed)) return { success: false }
          let bestChar = "["
          let base = 0
          const checked = new Set()
          for (const log of bleed.logs) {
            let jsonLog
            try { jsonLog = JSON.parse(log) } catch { continue }
            if (jsonLog.passwordAttempted.includes("[")) continue
            const attempted = jsonLog.passwordAttempted?.toString() ?? ""
            if (attempted.includes("[")) continue
            if (attempted.length !== correct.length + 1) continue
            if (!attempted.startsWith(correct.join(""))) continue

            const tested = attempted.split("").pop()
            if (tested == undefined || checked.has(tested.toString())) {
              continue
            }
            checked.add(tested.toString())
            testPool.delete(tested.toString())

            const response = Number(jsonLog.data.split(":")[1].replaceAll("ms", "").trim())
            if (!Number.isFinite(response)) {
              continue
            }

            if (base === 0) {
              base = response
              bestChar = tested
            }
            else if (base > response + 0.001) {
              correct.push(bestChar)
              i = 0
              testPool = new Set()
              break
            }
            else if (response > base + 0.001) {
              correct.push(tested)
              i = 0
              testPool = new Set()
              break
            }
          }
          if (testPool.size === 1) { //We skipped it, because we didn't catch it in the bleed.  It took too long
            correct.push(testPool.values().next().value)
            i = 0
            extraTime += 5
          }
          if (testPool.size > 1) { //We skipped it and others
            i = 0
            extraTime += 5
          }
          testPool = new Set()
        }
        if (i === testing.length - 1) { //We are on the last character choice.  Has to be it.
          correct.push(testing[testing.length - 1])
          i = 0
        }
        if (i === testing.length) { //We failed this pass          
          correct.pop()
          extraTime += 5
          i = 0
        }
        const newMax = await getMaxAuthThreads(ns, true)
        if (newMax > maxTotalThreads) {
          maxTotalThreads = newMax
          maxThreads = Math.max(1, Math.floor(maxTotalThreads / 11))
          threadsFactor = 1 / (1 + 0.2 * (maxThreads - 1))
        }
        sharedCharsExtraTime = (correct.length + 1) * 50 * threadsFactor
        record()
      }
      const results = await goToWork(ns, server, correct.join("").toString(), tries, details)
      if (results.success || !serverCheck(ns, server, details, results)) return results
      failureReport(ns, server, details)
      return { success: false }
    }
    case "EuroZone Free": {
      tries = inProgress.get(server)?.tries ?? 1
      let pool = euCountries.filter((p) => p.length === details.passwordLength)
      const guessed = new Set(inProgress.get(server)?.guessed ?? [])
      pool = pool.filter(p => !guessed.has(p))
      let maxTotalThreads = await getMaxAuthThreads(ns)
      let rate = pool.length > 10 ? 10 : pool.length
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / rate))
      let running = 0
      const processing = []
      while (pool.length) {
        const guess = pool.pop()
        if (guessed.has(guess)) continue
        running++
        goToWork(ns, server, guess.toString(), tries, details, maxThreads).then((results) => {
          running--
          processing.push(results)
        })
        guessed.add(guess.toString())
        if (pool.length > 0 && (running * maxThreads) + maxThreads <= maxTotalThreads) continue
        while (running > 0) await ns.asleep(4)
        for (const results of processing)
          if (results.success) return results
        if (!serverCheck(ns, server, details, processing[processing.length - 1])) return { success: false }
        tries++
        const newMax = await getMaxAuthThreads(ns, true)
        if (newMax > maxTotalThreads) {
          maxTotalThreads = newMax
          rate = pool.length > 10 ? 10 : pool.length
          maxThreads = Math.max(1, Math.floor(maxTotalThreads / rate))
        }
        inProgress.set(server, {
          details: details,
          tries: tries,
          guessed: Array.from(guessed)
        })
      }
      failureReport(ns, server, details)
      return { success: false }
    }
    case "PrimeTime 2": {
      const testing = Number(details.data)
      let result = false
      for (let i = largePrimes.length - 1; i >= 0; i--)
        if (testing % largePrimes[i] === 0) {
          result = await goToWork(ns, server, largePrimes[i].toString(), tries++, details)
          break
        }
      if (result && (result.success || !serverCheck(ns, server, details, result))) return result
      failureReport(ns, server, details)
      return result
    }
    case "MathML": {
      const finishedExpression = []
      const expression = details.data.split(",")
      for (const exp of expression) {
        if (exp.includes("alert") || exp.includes("globalThis") || exp.includes("you")) continue
        const finished = exp.replaceAll("➖", "-").replaceAll("➕", "+").replaceAll("ҳ", "*").replaceAll("÷", "/").replaceAll("ns.exit()", "")
        finishedExpression.push(finished)
      }
      const answer = evaluateArithmeticExpression(finishedExpression.join(""))
      const result = await goToWork(ns, server, answer.toString(), tries++, details)
      if (result.success || !serverCheck(ns, server, details, result)) return result
      failureReport(ns, server, details)
      return result
    }
    case "TopPass": {
      let pool
      tries = inProgress.get(server)?.tries ?? 1
      const guessed = new Set(inProgress.get(server)?.guessed ?? [])
      if (details.passwordFormat === "numeric")
        pool = commonPWDict.filter((f) => f.length === details.passwordLength && isNumeric(f))
      else if (details.passwordFormat === "alphabetic")
        pool = commonPWDict.filter((f) => f.length === details.passwordLength && isAlphabetic(f))
      else pool = commonPWDict.filter((f) => f.length === details.passwordLength && isAlphanumeric(f))
      pool = pool.filter(p => !guessed.has(p))
      let maxTotalThreads = await getMaxAuthThreads(ns)
      let running = 0
      const processing = []
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / Math.floor(pool.length, 10)))
      while (pool.length > 0) {
        const guess = pool.pop()
        if (guessed.has(guess)) continue
        running++
        goToWork(ns, server, guess.toString(), tries, details, maxThreads).then((results) => {
          running--
          processing.push(results)
        })
        guessed.add(guess.toString())
        if (pool.length > 0 && (running * maxThreads) + maxThreads <= maxTotalThreads) continue
        while (running > 0) await ns.asleep(4)
        for (const results of processing)
          if (results.success) {
            return results
          }
        if (!serverCheck(ns, server, details, processing[processing.length - 1])) return { success: false }
        const newMax = await getMaxAuthThreads(ns, true)
        if (newMax > maxTotalThreads) {
          maxTotalThreads = newMax
        }
        tries++
        if (pool.length > 0) maxThreads = Math.max(1, Math.floor(maxTotalThreads / Math.min(pool.length, 10)))
        inProgress.set(server, {
          details: details,
          tries: tries,
          guessed: Array.from(guessed)
        })
      }
      failureReport(ns, server, details)
      return { success: false }
    }
    case "OrdoXenos": {
      const parts = details.data.split(";")
      const maskStr = parts.pop().trim()
      const encrypted = parts.join(";")
      const mask = maskStr.split(/\s+/).map(b => parseInt(b, 2))
      let decoded = ""
      for (let i = 0; i < encrypted.length; i++) {
        decoded += String.fromCharCode(encrypted.charCodeAt(i) ^ mask[i])
      }
      const result = await goToWork(ns, server, decoded.toString(), tries++, details)
      if (result.success || !serverCheck(ns, server, details, result)) return result
      failureReport(ns, server, details)
      return { success: false }
    }
    case "KingOfTheHill": {
      const length = details.passwordLength
      const MIN = Math.pow(10, length - 1)
      const MAX = Math.pow(10, length) - 1
      const trueHillMinWidth = Math.max(1, Math.pow(10, length - 2))
      const minHillSpacing = 3 * Math.pow(10, length - 2)
      let tries = inProgress.get(server)?.tries || 1
      let guessed = new Set(inProgress.get(server)?.guessed || [])
      let guessedAltitudes = inProgress.get(server)?.guessedAltitudes || {}
      let solved = false
      let solvedResult = null
      let maxTotalThreads = await getMaxAuthThreads(ns, true)
      if (maxTotalThreads < 3) return { success: false }
      function record() {
        inProgress.set(server, {
          details: details,
          tries: tries,
          guessed: Array.from(guessed),
          guessedAltitudes: guessedAltitudes
        })
      }
      async function getAltitude(x) {
        const newMax = await getMaxAuthThreads(ns, true)
        if (newMax > maxTotalThreads) {
          maxTotalThreads = newMax
        }
        if (guessed.has(x)) return guessedAltitudes[x] //Don't guess again.  This is all that really has to be recorded
        let altitude = -Infinity
        let result
        let running = 0
        running++
        goToWork(ns, server, x.toString(), tries++, details, Math.floor(maxTotalThreads / 2)).then((results) => {
          result = results
          running--
        })
        let bleed
        running++
        bleedGrab(ns, server, 999, Math.floor(maxTotalThreads / 2)).then((bleedResults) => { //Bleed takes longer than auth at the same threads
          running--
          bleed = bleedResults
        })
        while (running > 0) await ns.asleep(4)
        if (result.success || !serverCheck(ns, server, details, result) || !await bleedCheck(ns, server, details, bleed)) {
          solved = true
          solvedResult = result
          return Infinity
        }
        for (const log of bleed.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog?.passwordAttempted.toString() !== x.toString()) continue
          altitude = Number(jsonLog.data)
          break
        }
        guessed.add(x)
        guessedAltitudes[x] = altitude
        record()
        return altitude
      }
      //We only really need to record guesses and their answers at this point.  The rest is procedural, and will always follow the same path
      const candidateQueue = []
      const stepBonus = length >= 3 ? minHillSpacing : 0 //Length 3 is guaranteed to have extra hills, 2 can but only at high difficulty
      let running = 0
      let processing = []
      let bleedResults
      let needsTesting = []
      if (length === 1) {
        for (let x = 0; x <= 9 && !solved; x++) {
          if (!guessed.has(x)) needsTesting.push(x)//await getAltitude(x)
        }
      } else {
        //The true hill could be at the extreem of left or right.  So, start in a way that we will catch these cases
        if (!guessed.has(MIN + (Math.max(0, Math.floor(trueHillMinWidth / 2))))) needsTesting.push(MIN + (Math.max(0, Math.floor(trueHillMinWidth / 2))))
        if (!guessed.has(MAX - (Math.max(0, Math.floor(trueHillMinWidth / 2))))) needsTesting.push(MAX - (Math.max(0, Math.floor(trueHillMinWidth / 2))))
        for (let step = Math.ceil((MIN + (Math.max(0, Math.floor(trueHillMinWidth / 2)))) + trueHillMinWidth); step < MAX && !solved; step += Math.max(4, Math.ceil((trueHillMinWidth + stepBonus) / 2))) {
          if (!guessed.has(step)) needsTesting.push(step)
        }
      }
      maxTotalThreads = await getMaxAuthThreads(ns, true)
      let maxThreads = Math.max(1, Math.floor(maxTotalThreads / (needsTesting.length + 1)))
      while (needsTesting.length > 0) {
        const test = needsTesting.pop()
        running++
        goToWork(ns, server, test.toString(), tries, details, maxThreads).then((results) => {
          running--
          processing.push(results)
        })
        if (needsTesting.length > 0 && (running * maxThreads) + (maxThreads * 2) <= maxTotalThreads) continue //Saving 1 maxThreads for heartbleed
        running++
        bleedGrab(ns, server, 999, maxThreads).then((bleed) => { //Bleed takes longer than auth at the same threads
          running--
          bleedResults = bleed
        })
        while (running > 0) await ns.asleep(4)
        for (const results of processing)
          if (results.success) return results
        if (!await bleedCheck(ns, server, details, bleedResults)) return { success: false }
        for (const log of bleedResults.logs) {
          let jsonLog
          try { jsonLog = JSON.parse(log) } catch { continue }
          if (jsonLog.passwordAttempted.toString().length !== details.passwordLength) continue
          if (!isNumeric(jsonLog.passwordAttempted)) continue
          const altitude = Number(jsonLog.data)
          guessed.add(Number(jsonLog.passwordAttempted))
          guessedAltitudes[Number(jsonLog.passwordAttempted)] = altitude
        }
        const newMax = await getMaxAuthThreads(ns, true)
        if (newMax > maxTotalThreads) {
          maxTotalThreads = newMax
          maxThreads = Math.max(1, Math.floor(maxTotalThreads / (needsTesting.length + 1)))
        }
        tries++
        record()
      }
      //Now that the coarse scan is out of the way, start the climbs.
      //The true hill could be at the extreem of left or right.  So, start in a way that we will catch these cases
      candidateQueue.push({ x: (MIN + (Math.max(0, Math.floor(trueHillMinWidth / 2)))), alt: await getAltitude((MIN + (Math.max(0, Math.floor(trueHillMinWidth / 2))))) })
      candidateQueue.push({ x: (MAX - (Math.max(0, Math.floor(trueHillMinWidth / 2)))), alt: await getAltitude((MAX - (Math.max(0, Math.floor(trueHillMinWidth / 2))))) })
      for (let step = Math.ceil((MIN + (Math.max(0, Math.floor(trueHillMinWidth / 2)))) + trueHillMinWidth); step < MAX && !solved; step += Math.max(4, Math.ceil((trueHillMinWidth + stepBonus) / 2))) {
        candidateQueue.push({ x: step, alt: await getAltitude(step) })
      }

      candidateQueue.sort((a, b) => b.alt - a.alt)
      for (const test of candidateQueue) {
        if (solved) break
        //Each test is a possible true hill, sorted by highest first
        //Get direction
        let direction = 0
        if (test.x < MAX) {
          let checkPoint = await getAltitude(test.x + 1) //Test 1 to the right
          if (test.alt > checkPoint) direction = -1 //We are moving left
          else if (test.alt < checkPoint) direction = 1 //We are moving right
        }
        else {
          let checkPoint = await getAltitude(test.x - 1) //Test 1 to the left
          if (test.alt < checkPoint) direction = -1 //We are moving left
          else if (test.alt > checkPoint) direction = 1 //We are moving right
        }
        if (solved) break
        if (direction === 0) continue
        //Climb and refine that hill.
        let step = length === 1 ? 1 : length === 2 ? 2 : Math.ceil((minHillSpacing + trueHillMinWidth) / 3)
        let pivot = test
        while (!solved) {
          //If checked1 is higher, we have a new pivot and need to check around it
          //Even if it's higher, we could be on the other side of the hill and need to change direction
          //If it's lower, we keep our pivot point and still halve the step.
          let checked1 = await getAltitude(Math.max(MIN, Math.min(MAX, pivot.x + (direction * step))))
          if (checked1 > pivot.alt) {
            pivot = { x: Math.max(MIN, Math.min(MAX, pivot.x + (direction * step))), alt: checked1 }
            step = Math.ceil(step / 2)
            continue
          }
          let checked2 = await getAltitude(Math.max(MIN, Math.min(MAX, pivot.x + (direction * step * -1))))
          if (checked2 > pivot.alt) {
            pivot = { x: Math.max(MIN, Math.min(MAX, pivot.x + (direction * step * -1))), alt: checked2 }
            step = Math.ceil(step / 2)
            direction *= -1
            continue
          }
          if (step === 1) break
          step = Math.ceil(step / 2)
        }
      }
      if (solved) return solvedResult
      failureReport(ns, server, details)
      return { success: false }
    }
    /**
     * The Labyrinth solver is needlessly complex.  It was born of boredom and testing out Claude Code vs Codex side to side
     * for both raw creation ability, troubleshooting, error finding, and all sorts of work tasks such as suggesting alternatives, adding
     * diagnostics, removing unneeded pathing code, etc.
     * It is a combination of Frontier Claiming to allow multiple workers to do different things in tandem, claim handoff/retarget to a closer worker,
     * and the raw power of the Dijkstra routing algorithm - which is what a*(a Star) is based off of.
     * The Labyrinth is split into 4 quadrants.  We will call them 1, 2, 3 and 4 or top right, top left, bottom left, bottom right with the start being
     * in quadrant 2.  Quadrant 4 is split into 4 of it's own subquadrants, with the end goal being it it's sub quadrant 4
     * As a network system engineer, I threw out the old solver once I realized that this was actually a basic routed network.
     * 
     * 
     * Let me explain:
     * 
     * You know the dimensions of each Labyrinth based on the charisma required for it.
     * With that knowledge, you can split the Labyrinth up into 4 seperate quadrants with boundary walls between them.
     * You now have 4 quadrants, or rather you have 4 subnets.
     * Each room has a unique coordinate, or MAC address.
     * You have rooms with 3 or 4 exits.  These are routers
     * You have rooms with 2 exits.  These are corridors, or higher cost routes.
     * You have rooms with 1 exit.  These are dead ends, or stub nodes.
     * You have 1 passageway into a different quadrant on their border walls.  These are gateways.
     * You know the exit nodes are in quadrant 4's sub-quadrant 4.  Since all MAC addresses are known by map position, you know your general target.
     * 
     * You have everything you need to build up a routed network with the Dijkstra routing protocol.  Just add each node to the routing table for that subnet.
     * This isolates (as subnets tend to do), the larger broadcast traffic you may need to send out.  It only has to reach everything in that quadrant/subnet.  After
     * that you can stop it's progress.  This is why subnets were invented in the first place, to stop broadcast traffic from taking down the whole network.
     * 
     * This avoids flood fills at all cost.  Instead prefering a Dijkstra route.  It moves 1 space at a time and then finds it's next hop from the routing table,
     * but it knows it's full route when it's created so it can do a handoff easier.
     * Dead end detection is done using known wall locations, and rather than doing a flood fill of the area it walks the wall.  This removes all the checks for
     * the larger areas of unexplored space.  It also respects the subnet it is in.  Once a dead end is located, it is cached for future lookups and to
     * prevent a worker from claiming that frontier.
     * 
     * So, your goal - translated into a network packet - is simple.  Move from quadrant 2 to quadrant 4 sub-quadrant 4.  Your starting objective is to find the
     * gateway into the next quadrant.  Once there, find the gateway into quadrant 4.  Once there, find the path to sub-quadrant 4 (specifically the bottom right
     * of it) and explore it.
     * 
     * The conclusion?  Tie, with the tie breaker going to Codex.
     * With the release of GPT 5.5 and Opus 4.7 things have change.
     * -With GPT 5.5, on the highest thinking level, I get about 2 days of actually sitting at the computer and trying stuff out.  After that, my ~$28ca subscription
     * runs out of weekly (5 day) allotment of tokens.
     * -With the same subscription level for Claude Code, Opus 4.7 required the medium setting be used - or it risked using all it's 5 hour allotment immediately.
     * -Using medium thinking, it is just as capable as Codex if not more capable.  Opus 4.7 on Medium seems to be a better choice than GPT 5.5 on it's highest.
     * -I get around 1-5 requests every 5 hours with Opus 4.7, usually running out of my 5 day allotment within 1 - 2 days.  While the product was better,
     * I got very little done with Opus 4.7 overall
     * -One sad thing to note, I tried to get a prompt from Opus 4.7 3 times, and it failed to remember the prompt but used up my tokens.  I then asked it to do
     * something simple at it's highest thought and it immediately ran out of my 5 hour allotment.
     * 
     * Both subscriptions cost the same, but I feel that you require the $100-$200+/m subscription for Opus in order to use it properly, while the $100/m sub for
     * GPT 5.5 will actually let you code all day, with multiple prompts churning at once and not run out of your 5 hour/day allotment, unless you work more than
     * 5 days a week or play with it over the weekend.  I would highly recommend a ChatGPT Plus subscription to anyone who wants to dabble.  Stay away from
     * Claude unless your employer buys you the $200 subscription.
     * 
     * Don't become reliant on it though.  It need to remain a tool.  A helper.  You should always have in mind what your code is supposed to do so you can
     * trouble shoot things when AI gets it wrong.  And you will need to troubleshoot.
     * 
     * Now, take all of the above and scrap it.  While it worked perfectly, it was a 11k+ line script AND when testing at max charisma the Lab was actually lagging
     * 
     * Instead, I lifted a few working things from the previous version.
     * -Goalward directions are based on quadrant, and it points to the quadrant boarder (including moves that end up at the boarder wall), or the exit area
     * -Forward directions are based on quadrant, they are directions that are not goalward (say right or left when the goal is down) but still give forward progress
     * -Alt directions are based on quadrant, they are the direction in the opposit way of the goal
     * -Dead end room detection will walk the walls to see if an area is enclosed
     * -Quadrants are ranked in priority (Start is least, the end quadrant is the highest)
     * -You cannot move into a worse rank quadrant
     * -The exit quadrant is broken up into it's own subquadrants, with the exit sub quadrant being the bottom right of those sub quadrants
     * -Dead end detection is disabled if the path goes through the exit subquadrant
     * -Within the exit subquadrant, pathways are marked as blocked only when they have been fully searched
     * -If a worker leave the exit subquadrant, it's goalward move will be into the exit subquadrant
     * 
     * Movement choices:
     * -First, depending on location, dead end room detection will filter out any rooms that lead into dead ends
     * -1 If all exits have been explored, the worker will take the exit that is closest the the possible goalward crossing
     * -2 The worker will pick the goalward movement that has not been explored yet
     * -3 If there is a tie for 2, it will choose the route with the least cost.  If that is a tie, the route of the lowest number/direction is chosen
     * -4 The worker will pick the forward movement that has not been explored yet
     * -5 If there is a tie for 4, the same things in 3 apply
     * -6 If we are here, and there is an alt direction to take, take it
     * -7 We likely have to backtrack into an area that's not blocked
     * 
     * 
     * 
     * Have fun
     * -Sphyxis
     */
    case "(The Labyrinth)": {
      if (labComplete !== false) return { success: false }
      let lastBlockedRam = Infinity
      while (ns.dnet.getServerDetails(server).isConnectedToCurrentServer) {
        const blockedRam = ns.dnet.getBlockedRam(ns.self().server)
        if (blockedRam <= 0) break
        if (blockedRam >= lastBlockedRam) break
        lastBlockedRam = blockedRam
        if (!await threadedMemoryRealloc(ns, ns.self().server, complete.get(ns.self().server).pw)) return { success: false }
      }

      if (!ns.dnet.getServerDetails(server).isConnectedToCurrentServer) return { success: false }
      if (player.skills.charisma < chaReq) return { success: false }
      if (!ns.dnet.getStasisLinkedServers().includes(ns.self().server) && ns.dnet.getStasisLinkLimit() > ns.dnet.getStasisLinkedServers().length) {
        const freeRam = await proxyHome(ns, "getServerMaxRam", ns.self().server) - await proxyHome(ns, "getServerUsedRam", ns.self().server)
        if (freeRam >= 13.6) {
          await proxyLocal(ns, true, "dnet.setStasisLink")
        } else {
          ns.ramOverride(16)
          await ns.dnet.setStasisLink()
          ns.exit()
        }
      }
      if (!ns.dnet.getServerDetails(server).isConnectedToCurrentServer) {
        if (ns.dnet.getStasisLinkedServers().includes(ns.self().server)) await proxyLocal(ns, true, "dnet.setStasisLink", false)
        return { success: false }
      }
      if (!labName) {
        labName = server
        // First worker on a fresh maze name: clear any stale frozen ring
        // from a previous run.  Per-worker spawns within the same maze
        // keep accumulating into the same ring so we see all workers'
        // recent decisions in one place.
        const initialLabState = getLabState(server, details)
        if (!initialLabState.layout) {
          initialLabState.layout = getEstimatedLabLayout(chaReq)
          if (initialLabState.layout) {
            syncLabDisplayMap(initialLabState, true)
            inProgress.set(server, initialLabState)
          }
        }
      }
      tries = 1
      const workerId = ns.self().server + "-" + ns.pid
      const failLab = (reason) => {
        return { success: false }
      }
      let claim = null
      let skippedClaimKeys = new Set()
      let labWorker = 0
      let trackedLease = null
      let noClaimPasses = 0
      let labExitHookRegistered = false

      const markSkippedClaim = (badClaim) => {
        const key = typeof badClaim?.key === "string" && badClaim.key ? badClaim.key : (Number.isInteger(badClaim?.x) && Number.isInteger(badClaim?.y) ? getLabKey(badClaim.x, badClaim.y) : "")
        if (!key) return
        skippedClaimKeys.add(key)
        if (skippedClaimKeys.size > 64) skippedClaimKeys = new Set([key])
      }
      const pickLabClaimAt = (x, y) => pickGreedyStepLegacy(server, workerId, x, y, skippedClaimKeys)
      const updateTrackedLease = (nextClaim = null) => {
        if (trackedLease) {
          trackedLease.server = server
          trackedLease.claim = nextClaim ?? null
          trackedLease.workerId = workerId
          return
        }
        trackedLease = { server, claim: nextClaim ?? null, workerId }
      }
      const releaseTrackedLease = () => {
        trackedLease = null
      }
      const syncLabExit = () => {
        if (labExitHookRegistered) return
        labExitHookRegistered = true
        ns.atExit(() => {
          clearLabWorkerPosition(server, workerId)
        })
      }
      const shouldPersistLabState = () => labComplete === false || inProgress.has(server)
      const refreshLabState = () => {
        if (!shouldPersistLabState()) return
        const state = inProgress.get(server)
        if (state?.layout && state.layout.estimated !== true) return
        ensureLabLayout(server, details, chaReq)
      }
      const prepareLabEntry = async () => {
        let lastBlocked = Infinity
        while (ns.dnet.getServerDetails(server).isConnectedToCurrentServer) {
          const blocked = ns.dnet.getBlockedRam(ns.self().server)
          if (blocked <= 0) break
          if (blocked >= lastBlocked) break
          lastBlocked = blocked
          if (!await threadedMemoryRealloc(ns, ns.self().server, complete.get(ns.self().server).pw)) return false
        }
        if (!ns.dnet.getServerDetails(server).isConnectedToCurrentServer) return false
        if (!ns.dnet.getStasisLinkedServers().includes(ns.self().server)
          && ns.dnet.getStasisLinkLimit() > ns.dnet.getStasisLinkedServers().length
          && await proxyHome(ns, "getServerMaxRam", ns.self().server) - await proxyHome(ns, "getServerUsedRam", ns.self().server) >= 13.6) {
          await proxyLocal(ns, true, "dnet.setStasisLink")
        }
        return ns.dnet.getServerDetails(server).isConnectedToCurrentServer
      }
      const launchLabWorker = async () => {
        let pid = await startLabWorker(ns, server)
        if (pid) return pid
        if (!await prepareLabEntry()) {
          return 0
        }
        pid = await startLabWorker(ns, server)
        return pid
      }

      const stopLabWorker = async (pid = labWorker) => {
        if (!pid) return
        await proxyHome(ns, "kill", pid)
        clearLabWorkerPosition(server, workerId)
        if (labWorker === pid) labWorker = 0
        syncLabExit()
      }
      const adoptSharedBootstrap = () => {
        return false
      }
      const commitBootstrapRoom = (roomReport) => {
        const root = getLabRootRoom(server)
        const bootstrapX = root?.x ?? 1
        const bootstrapY = root?.y ?? 1
        recordLabRoom(server, details, bootstrapX, bootstrapY, roomReport, [])
        const [rootX, rootY] = getLabActualCoords(bootstrapX, bootstrapY, roomReport, inProgress.get(server))
        const bootstrapState = inProgress.get(server)
        addLabStartMarker(bootstrapState, rootX, rootY, workerId)
        inProgress.set(server, bootstrapState)
        updateLabWorkerPosition(server, details, workerId, rootX, rootY)
        // Fresh maze entry — drop any stale visit history from a prior run.
        clearLabWorkerVisitStack(workerId)
        updateTrackedLease(null)
        syncLabExit()
        return { success: true }
      }
      const bootstrapLabyrinth = async () => {
        const probe = await labWork(ns, labWorker, labCurrentRoomCommand)
        if (probe?.workerExited) {
          clearLabWorkerPosition(server, workerId)
          resetLabWorkerRef()
          if (adoptSharedBootstrap()) return { success: true }
          return failLab("bootstrap-worker-exited")
        }
        if (probe?.finished) {
          const completedState = getCompletedLabStateRef(inProgress.get(server) ?? getLabCompleteState())
          return finalizeLabCompletion(probe.authResults.data, completedState, tries + 1)
        }
        if (probe?.report?.success === false) {
          if (adoptSharedBootstrap()) return { success: true }
          await stopLabWorker()
          return failLab("bootstrap-report-failed")
        }
        const probeReport = probe?.report
        if (probeReport) return commitBootstrapRoom(probeReport)
        if (!serverCheck(ns, server, details, probe?.authResults)) {
          if (adoptSharedBootstrap()) return { success: true }
          await stopLabWorker()
          return failLab("bootstrap-lost-server")
        }
        if (adoptSharedBootstrap()) return { success: true }
        await stopLabWorker()
        return failLab("bootstrap-no-report")
      }
      const releaseLease = () => {
        releaseTrackedLease()
        claim = null
        syncLabExit()
      }
      const resetLabWorkerRef = (pid = labWorker) => {
        if (labWorker === pid) labWorker = 0
        syncLabExit()
      }
      const stopAllLabWorkers = async () => {
        if (labWorker) await stopLabWorker(labWorker)
      }
      const finalizeLabCompletion = async (answer, completedState, triesUsed) => {
        const existingCompletedState = getLabCompleteState()
        const existingCompletedAnswer = getLabCompleteAnswer()
        if (existingCompletedState?.details?.modelId === "(The Labyrinth)" && existingCompletedState.rooms) {
          completedState = getCompletedLabStateRef(existingCompletedState)
          if (typeof existingCompletedAnswer === "string" && existingCompletedAnswer) answer = existingCompletedAnswer
        }
        clearLabWorkerPosition(server, workerId)
        setCompletedLabState(answer, completedState, server)
        inProgress.delete(server)
        releaseTrackedLease()
        claim = null
        //if (labName === server) labName = false
        await stopAllLabWorkers()
        syncLabExit()
        updateFull(server, answer, details)
        updateTelemetry(details, triesUsed, server)
        return { success: true, data: answer }
      }
      const loseLabyrinth = async () => {
        clearLabWorkerPosition(server, workerId)
        await stopAllLabWorkers()
        releaseLease()
      }
      function getLabRootRoom(server) {
        if (!labState || labState.serverName !== server) return null
        if (typeof labState.rootKey !== "string" || !labState.rootKey) return null
        return labState.rooms?.[labState.rootKey] ?? null
      }
      const rootRoom = getLabRootRoom(server)
      if (!rootRoom?.jsonLog) {
        ns.clearPort(ns.pid)
        labWorker = await launchLabWorker()
        if (labWorker === 0) return failLab("launch-worker-bootstrap")
        syncLabExit()
        const bootstrapResult = await bootstrapLabyrinth()
        if (bootstrapResult?.success !== true) return failLab("bootstrap")
        if (bootstrapResult?.data) return bootstrapResult
      }
      ensureLabLayout(server, details, chaReq)
      syncLabExit()

      // Once bootstrap has pinned this process's room, every later position
      // update must come from movement.  Do not re-labreport to recover a
      // lost worker position; stop this worker instead.
      if (!labWorker) {
        ns.clearPort(ns.pid)
        labWorker = await launchLabWorker()
        if (labWorker === 0) return failLab("launch-worker-init")
      }
      if (!getLabWorkerPosition(server, workerId)) {
        const bootstrapResult = await bootstrapLabyrinth()
        if (bootstrapResult?.success !== true) return failLab("init-bootstrap-missing-position")
        if (bootstrapResult?.data) return bootstrapResult
      }
      if (!getLabWorkerPosition(server, workerId)) {
        await stopLabWorker()
        return failLab("init-missing-position")
      }

      while (labComplete === false) {
        const workerPosition = getLabWorkerPosition(server, workerId)
        if (!workerPosition) return failLab("missing-position")
        const [startX, startY] = workerPosition
        if (!claim) {
          updateTrackedLease(null)
          // Standard picker chain.  When all of those return null (typical
          // for secondary workers entering a maze where the primary already
          // claimed everything, or for a worker whose only candidates trip
          // the heuristic filters), fall through to the routing-tree
          // "nearest goalforward" claimer that ignores those heuristics and
          // simply picks the closest reachable frontier.  This is what
          // keeps the worker from doing nothing on entry.
          claim = pickLabClaimAt(startX, startY)
          updateTrackedLease(claim)
        } else {
          updateTrackedLease(claim)
        }

        if (!claim) {
          // Picker found no candidate this iteration.  pickGreedyStep
          // should only return null when this worker has no useful work.
          // Clear skipped claims once, then stop this worker instead of
          // spinning an awaited idle loop while other workers continue.
          if (skippedClaimKeys.size > 0 && noClaimPasses === 0) {
            skippedClaimKeys.clear()
            noClaimPasses++
            continue
          }
          await stopLabWorker()
          return failLab("no-claim")
        }
        noClaimPasses = 0

        let roomReport = getLabRoomReport(server, claim.x, claim.y) || false
        const currentPosition = getLabWorkerPosition(server, workerId)
        if (!currentPosition) return failLab("missing-current-position")
        const [currentX, currentY] = currentPosition
        const claimRoom = getLabRoom(server, claim.x, claim.y)
        if (claimRoom?.claimedBy && claimRoom.claimedBy !== workerId) {
          releaseLease()
          claim = null
          continue
        }
        // NOTE: in darknetBasic the greedy picker intentionally returns
        // already-explored targets for backsteps and explored goalward /
        // forward priorities.  The legacy "reject explored claim" guard
        // here would release the claim and loop synchronously on the same
        // pick, hanging the renderer.  Trust the picker — if it returned an
        // explored target, walking there is the desired behaviour.
        if (currentX !== claim.x || currentY !== claim.y) {
          const moved = await walkLabToTarget(ns, server, details, workerId, labWorker, claim, { maxSteps: labWalkStepChunk, reason: claim.gateway ? "gateway-claim" : "claim" })
          tries += moved.stepsTaken ?? 0
          if (moved.finished) {
            const completedState = getCompletedLabStateRef(inProgress.get(server) ?? getLabCompleteState())
            if (completedState?.layout && Number.isInteger(moved.exitX) && Number.isInteger(moved.exitY)) {
              completedState.layout.finishX = moved.exitX
              completedState.layout.finishY = moved.exitY
            }
            if (completedState && Number.isInteger(moved.exitX) && Number.isInteger(moved.exitY)) completedState.finishKey = getLabKey(moved.exitX, moved.exitY)
            await finalizeLabCompletion(moved.authResults.data, completedState, tries)
            return moved.authResults
          }
          if (moved.workerExited) {
            releaseLease()
            clearLabWorkerPosition(server, workerId)
            resetLabWorkerRef()
            return failLab("claim-worker-exited")
          }
          if (moved.lostServer) {
            releaseLease()
            await stopLabWorker()
            return failLab("claim-lost-server")
          }
          if (moved.quadrantCrossed) {
            // Crossed into a more-goalward quadrant mid-walk.  Drop the
            // existing claim so the picker chain re-runs from the new
            // in-quadrant position; this gives claimImmediateGoalwardCrossing
            // and claimAdjacentLabRoom first crack at any local goalward
            // frontier before the routed picker reaches for distant work.
            releaseLease()
            claim = null
            continue
          }
          if (moved.stepLimit && (moved.stepsTaken ?? 0) > 0) {
            skippedClaimKeys.clear()
            continue
          }
          if (moved.arrived !== true) {
            if ((moved.noRoute || moved.blocked || (moved.stepsTaken ?? 0) === 0) && claim) {
              markSkippedClaim(claim)
            }
            releaseLease()
            claim = null
            continue
          }
          if (moved.report) roomReport = moved.report
        }
        if (!roomReport) {
          releaseLease()
          continue
        }
        // walkLabToTarget already called updateLabWorkerPosition and (for
        // newly-discovered rooms) recordLabRoom on its final step.  The
        // legacy duplicate calls below ran no-op guard paths every claim
        // arrival; eliminating them removes one redundant pair of
        // inProgress.set + state-version bumps per step.
        const arrivalRoom = inProgress.get(server)?.rooms?.[claim.key]
        const roomX = arrivalRoom?.x ?? claim.x
        const roomY = arrivalRoom?.y ?? claim.y
        skippedClaimKeys.clear()
        releaseTrackedLease()
        claim = pickLabClaimAt(roomX, roomY)
        updateTrackedLease(claim)
      }
      await loseLabyrinth()
      return failLab("lab-complete-loop-ended")
    }
    case "": {
      return { success: false }
    }
    default:
      ns.tprintRaw("WARNING:  Unknown modelID for " + server + ": " + details.modelId + "  Details: " + JSON.stringify(details))
      return { success: false }

  }
}
function failureReport(ns, server, details) {
  ns.tprintf("ERROR:  Failure Report for %s vs %s %s Length: %s  Type: %s", ns.self().server, server, details.modelId, details.passwordLength, details.passwordFormat)
  inProgress.delete(server)
}
function getCurrentServerDetails(ns, server) {
  try { return ns.dnet.getServerDetails(server) } catch { return null }
}
function pruneSavedDarknetState(ns) {
  for (const [server, progress] of inProgress) {
    const currentDetails = getCurrentServerDetails(ns, server)
    if (!progress || typeof progress !== "object" || !currentDetails) {
      inProgress.delete(server)
      continue
    }
    if (!progress.details && progress.rooms && currentDetails.modelId === "(The Labyrinth)") progress.details = currentDetails
    if (!progress.details || !authDetailsMatch(progress.details, currentDetails)) inProgress.delete(server)
  }
}
/** @param {NS} ns */
async function validateProgress(ns, server, currentDetails = null) {
  if (!inProgress.has(server)) return
  const progress = inProgress.get(server)
  if (!progress || typeof progress !== "object") {
    inProgress.delete(server)
    return
  }
  const details = progress.details ?? (progress.rooms && currentDetails?.modelId === "(The Labyrinth)" ? currentDetails : null)
  if (!details || !validate(ns, server, details, currentDetails)) inProgress.delete(server)
}
/** @param {NS} ns */
function authDetailsMatch(details, currentDetails) {
  if (!details || !currentDetails) return false
  return !((details.modelId !== "(The Labyrinth)" && details.data !== currentDetails.data)
    || details.modelId !== currentDetails.modelId
    || details.passwordFormat !== currentDetails.passwordFormat
    || details.passwordHint !== currentDetails.passwordHint
    || details.passwordLength !== currentDetails.passwordLength)
}
/** @param {NS} ns */
function validate(ns, server, details, currentDetails = null) {
  return authDetailsMatch(details, currentDetails ?? ns.dnet.getServerDetails(server))
}
/** @param {NS} ns */
function serverCheck(ns, server, details, result) {
  // Sync — ns.dnet.getServerDetails is a synchronous game query.  Was
  // declared async historically; the now-removed `await` on every
  // walkLabToTarget step paid a microtask hop for nothing.  Per-step
  // microtask cost is small individually but stacks up across thousands
  // of moves, and matters more when the labWorker round-trip itself is
  // the only other yield point.
  if (!result) return false
  const details2 = ns.dnet.getServerDetails(server)
  if (connectFailures.includes(result.message) || !authDetailsMatch(details, details2)) return false
  return Boolean(details2.isConnectedToCurrentServer)
}
/** @param {NS} ns */
async function bleedCheck(ns, server, details, bleed) {
  if (!bleed || !bleed?.logs) return false
  const details2 = ns.dnet.getServerDetails(server)
  if (connectFailures.includes(bleed.message) || !authDetailsMatch(details, details2)) return false
  return Boolean(details2.isConnectedToCurrentServer)
}
async function threadedMemoryRealloc(ns, server, password) {
  const result = await proxyAuth(ns, "split", server, password, "dnet.memoryReallocation", server)
  return result.success
}
//Write a heartbleed proxy file and add a function for it
async function bleedGrab(ns, server, logs = 999, maxThreads = true, additionalMsec = 0) {
  const results = await proxyHeartbleed(ns, server, logs, maxThreads, additionalMsec)
  return results
}
/** @param {NS} ns */
function updateFull(server, password, details) {
  complete.set(server.toString(), { pw: password.toString(), details: details })
}
/** @param {NS} ns */
function updateWorkingOn(server, details, action) {
  if (details.modelId === "(The Labyrinth)") return
  if (action === "remove")
    workingOn.delete(server)
  else if (action === "set")
    workingOn.set(server, true)
}
/** @param {NS} ns */
function updateTelemetry(details, tries, server) {
  return //Just takes up space right now.  If we need to see the number of tries, we can enable it again
  if (tries === 0) return
  let key
  if (details.modelId === "(The Labyrinth)") key = details.modelId + server
  else key = details.modelId + details.passwordFormat + String(details.passwordLength)
  if (!telemetry[key]) telemetry[key] = []
  telemetry[key].push(tries)
}
/** @param {NS} ns */
async function goToWork(ns, server, answer, tries, details, useMaxThreads = true) {
  const results = await proxyLocal(ns, useMaxThreads, "dnet.authenticate", server, answer)
  if (results.success) {
    ns.dnet.connectToSession(server, answer)
    if (details.modelId !== "(The Labyrinth)") {
      inProgress.delete(server)
    }
    else {
      const completedState = getCompletedLabStateRef(inProgress.get(server))
      setCompletedLabState(answer, completedState, server)
      inProgress.delete(server)
    }
    updateFull(server, answer, details)
    updateTelemetry(details, tries, server)
  }
  return results
}

async function readQueuedPort(ns, port) {
  let result = ns.readPort(port)
  if (result !== "NULL PORT DATA") return result
  await ns.nextPortWrite(port)
  return ns.readPort(port)
}

function romanToDecimal(details) {
  if (details === "nulla") return 0
  const values = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000
  }
  let total = 0;
  const romanNums = details.split("")
  for (let i = 0; i < romanNums.length; i++) {
    const current = values[romanNums[i]]
    const next = values[romanNums[i + 1]]
    if (next && current < next) {
      total -= current
    } else {
      total += current
    }
  }
  return total
}
//Handles fractions...  Damn you
function convertToBase10(value) {//numberStr, base) {
  function charToValue(char) {
    if (char >= '0' && char <= '9') return char.charCodeAt(0) - 48
    if (char >= 'A' && char <= 'Z') return char.charCodeAt(0) - 55
    if (char >= 'a' && char <= 'z') return char.charCodeAt(0) - 87
    throw new Error(`Invalid digit: ${char}`)
  }
  const numberStr = value[0]
  const base = value[1]
  const [intPart, fracPart = ""] = numberStr.split('.')
  let result = 0
  // Integer part
  for (let i = 0; i < intPart.length; i++) {
    const digit = charToValue(intPart[i])
    result += digit * Math.pow(base, intPart.length - i - 1)
  }
  // Fractional part
  for (let i = 0; i < fracPart.length; i++) {
    const digit = charToValue(fracPart[i])
    result += digit * Math.pow(base, -(i + 1))
  }
  return result
}
function isNumeric(value) {
  if (value === true || value === false) return false
  if (typeof value === "number") return true
  if (typeof value !== "string") return false
  const testing = value.split("")
  for (const test of testing)
    if (test >= '0' && test <= "9") continue
    else return false
  return true
}
function isAlphabetic(value) {
  for (const test of value.split(""))
    if (!lettersLCase.concat(lettersUCase).includes(test.toString())) return false
  return true
}
function isAlphanumeric(value) {
  let numeric = false
  let alphabetic = false
  for (const test of value.split("")) {
    if (test >= '0' && test <= "9") numeric = true
    else if (lettersLCase.concat(lettersUCase).includes(test.toString())) alphabetic = true
  }
  return numeric && alphabetic
}
function factorial(n) {
  let result = 1n
  for (let i = 2n; i <= n; i++) {
    result *= i
  }
  return result
}
function permutationCount(arr) {
  const counts = new Map()
  for (const v of arr) {
    counts.set(v, (counts.get(v) || 0) + 1)
  }
  let numerator = factorial(BigInt(arr.length))
  let denominator = 1n
  for (const count of counts.values()) {
    denominator *= factorial(BigInt(count))
  }
  return numerator / denominator
}
//evaluateArithmetic was found in order to get rid of the eval
//eval creates debug information, and if your console is open and never closes
//it will eventually run out of memory and crash
function evaluateArithmeticExpression(source) {
  if (!/^[\d+\-*/().\s]+$/.test(source)) throw new Error("Invalid arithmetic expression");

  let index = 0;

  const skipWhitespace = () => {
    while (/\s/.test(source[index] ?? "")) index++;
  };

  const consume = (char) => {
    skipWhitespace();
    if (source[index] !== char) return false;
    index++;
    return true;
  };

  const parseNumber = () => {
    skipWhitespace();
    const start = index;
    let sawDot = false;

    while (/[0-9.]/.test(source[index] ?? "")) {
      if (source[index] === ".") {
        if (sawDot) break;
        sawDot = true;
      }
      index++;
    }

    const raw = source.slice(start, index);
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(raw)) throw new Error("Expected number");
    return Number(raw);
  };

  const parsePrimary = () => {
    if (consume("(")) {
      const value = parseAdditive();
      if (!consume(")")) throw new Error("Expected closing parenthesis");
      return value;
    }
    return parseNumber();
  };

  const parseUnary = () => {
    if (consume("+")) return parseUnary();
    if (consume("-")) return -parseUnary();
    return parsePrimary();
  };

  const parseMultiplicative = () => {
    let value = parseUnary();
    skipWhitespace();

    while (source[index] === "*" || source[index] === "/") {
      const operator = source[index++];
      const right = parseUnary();
      value = operator === "*" ? value * right : value / right;
      skipWhitespace();
    }

    return value;
  };

  const parseAdditive = () => {
    let value = parseMultiplicative();
    skipWhitespace();

    while (source[index] === "+" || source[index] === "-") {
      const operator = source[index++];
      const right = parseMultiplicative();
      value = operator === "+" ? value + right : value - right;
      skipWhitespace();
    }

    return value;
  };

  const value = parseAdditive();
  skipWhitespace();

  if (index !== source.length || !Number.isFinite(value)) throw new Error("Invalid arithmetic expression");
  return value;
}
const isWorker = (w) => !!w && typeof w.postMessage === "function"
async function getWorker(ns) {
  while (globalThis["SphyxOSDarknetWebWorkers"].length) {
    const entry = globalThis["SphyxOSDarknetWebWorkers"].shift()
    const worker = isWorker(entry?.workerReady) ? entry.workerReady : entry
    if (!isWorker(worker)) continue          // skip/discard garbage from older runs
    if (entry?.workerReady) return worker    // already reset & ready
    return new Promise((resolve) => {
      worker.onmessage = (event) => {
        if (event.data?.type === "reset-complete") resolve(worker)
      }
      worker.postMessage({ type: "reset" })
    })
  }
  const workerURL = URL.createObjectURL(blob)
  const worker = new Worker(workerURL)
  URL.revokeObjectURL(workerURL)
  return worker
}
const workerCode = `
// Does this candidate satisfy all constraints?
function candidateSatisfiesAll(x, constraints) {
  for (const { k, r } of constraints) {
    const m = k % 32;
    if (m === 0) continue;
    if ((x % k) % m !== r) return false;
  }
  return true;
}

// Extended GCD for modular inverse with a save return of null on 0
function modInverse(a, m) {
  a = ((a % m) + m) % m;
  if (m === 0) return null;

  let m0 = m;
  let x0 = 0, x1 = 1;

  while (a > 1) {
    if (m === 0) return null;

    const q = Math.floor(a / m);
    [a, m] = [m, a % m];
    [x0, x1] = [x1 - q * x0, x0];
  }

  if (x1 < 0) x1 += m0;
  return x1;
}


// Combine two modular constraints using CRT
function combineModConstraints(a1, m1, a2, m2) {
  // Enforce integer invariants early
  if (
    !Number.isInteger(a1) ||
    !Number.isInteger(m1) ||
    !Number.isInteger(a2) ||
    !Number.isInteger(m2)) { return null; }

  const d = gcd(m1, m2);
  if ((a2 - a1) % d !== 0) return null;
  const m1d = m1 / d;
  const m2d = m2 / d;
  const inv = modInverse(m1d, m2d);
  if (inv === null) return null;
  const t = ((a2 - a1) / d) % m2d;
  let x = a1 + m1 * ((t * inv) % m2d);
  const mod = m1 * m2d;

  // Normalize
  x = ((x % mod) + mod) % mod;

  // Final safety gate
  if (!Number.isInteger(x) || !Number.isInteger(mod)) return null;

  return { x, mod };
}


// Greatest common divisor
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

//Entry point
function getNextCandidate(data) {
  let [candidate, tripleConstraints, tries, MIN, MAX, tried] = data;
  const testGroup = [31, 29, 28, 27, 25, 23, 19, 17, 13, 11];
  
  // Phase 0 - baseline tests, adaptive to length.  Will go 1 over max as it tends to save 1 try
  let testedValue = 1;
  for (const p of testGroup) {
    testedValue *= p;
    if (!tried.has(p)) return p;
    if (testedValue > MAX) break;
  }

  // Phase 2: CRT
  const crtConstraints = tripleConstraints
    .map(({ k, r }) => ({ a: r, m: k % 32 }))
    .filter(c => c.m !== 0);

  if (crtConstraints.length > 0) {
    let crt = { x: crtConstraints[0].a, mod: crtConstraints[0].m };
    let valid = true;

    for (let i = 1; i < crtConstraints.length; i++) {
      const res = combineModConstraints(
        crt.x,
        crt.mod,
        crtConstraints[i].a,
        crtConstraints[i].m
      );

      if (res === null) {
        valid = false;
        break;
      }

      crt = res;
    }

    if (valid) {
      let x = crt.x;
      const mod = crt.mod;

      if (x < MIN) x += Math.ceil((MIN - x) / mod) * mod;

      while (x <= MAX) {
        if (!tried.has(x) && candidateSatisfiesAll(x, tripleConstraints)) {
          return x;
        }
        x += mod;
      }
    }
  }
  
  // Phase 3 - brute force with what we have
  let next = candidate + 1;
  let issue = false
  while (!candidateSatisfiesAll(next, tripleConstraints) || tried.has(next)) {
    next++;
    if (next > MAX) {
    if (issue) throw new Error("No possible code found for BigMod");
      next = MIN;
      issue = true;
    }
  }
  return next;
}
function getNextCode([tested, testFeedback, lastGuessRaw, pool, cursorRaw, timeBudgetMs]) {
  const length = lastGuessRaw.length;
  const candidate = new Array(length);
  const deadline = Date.now() + Math.max(50, Number(timeBudgetMs) || 1000);
  const TIMEOUT = { timeout: true };
  let checked = 0;
  let sawTestedCandidate = false;
  let lastChecked = [];

  function isValidCursor(cursor) {
    if (!Array.isArray(cursor) || cursor.length !== length) return false;
    for (const value of cursor) {
      if (!Number.isInteger(value) || value < 0 || value >= pool.length) return false;
    }
    return true;
  }

  const cursor = isValidCursor(cursorRaw)
    ? cursorRaw.slice()
    : isValidCursor(lastGuessRaw)
      ? lastGuessRaw.slice()
      : null;
  if (cursor) lastChecked = cursor.slice();

  function updatePrunedCursor(pos) {
    const pruned = candidate.slice(0, pos);
    while (pruned.length < length) pruned.push(pool.length - 1);
    lastChecked = pruned;
  }

  function dfs(pos, cursorRelation) {
    if (Date.now() > deadline) return TIMEOUT;
    if (pos === length) {
      if (cursor && cursorRelation !== 1) return null;
      checked++;
      const key = candidate.join(",");
      if (!tested.has(key) && isPossible(candidate, testFeedback)) {
        lastChecked = candidate.slice();
        return candidate.slice();
      }
      if (tested.has(key)) sawTestedCandidate = true;
      lastChecked = candidate.slice();
      return null;
    }

    for (let d = 0; d < pool.length; d++) {
      let nextCursorRelation = cursorRelation;
      if (cursor && cursorRelation === 0) {
        if (d < cursor[pos]) continue;
        if (d > cursor[pos]) nextCursorRelation = 1;
      }
      candidate[pos] = d;

      if (!prefixPossible(candidate, pos + 1, testFeedback)) {
        updatePrunedCursor(pos + 1);
        continue;
      }

      const result = dfs(pos + 1, nextCursorRelation);
      if (result === TIMEOUT || result) return result;
    }
    return null;
  }

  const result = dfs(0, cursor ? 0 : 1);
  if (result === TIMEOUT) {
    return { guess: null, cursor: lastChecked.slice(), checked, exhausted: false, sawTestedCandidate };
  }
  if (!result) {
    return { guess: null, cursor: lastChecked.slice(), checked, exhausted: true, sawTestedCandidate };
  }
  return { guess: result, cursor: result.slice(), checked, exhausted: false, sawTestedCandidate };
}

function prefixPossible(candidate, len, testFeedback) {
  for (const { guess, feedback } of testFeedback) {
    const targetBlk = Number(feedback.blk);

    let blk = 0;
    for (let i = 0; i < len; i++) {
      if (candidate[i] === guess[i]) {
        blk++;
        if (blk > targetBlk) return false;
      }
    }

    const remaining = guess.length - len;
    if (blk + remaining < targetBlk) return false;
  }
  return true;
}


function scoreFast(guessRaw, codeRaw, expected) {
  let blk = 0, wht = 0;
  const guessCount = new Map();
  const codeCount = new Map();

  for (let i = 0; i < guessRaw.length; i++) {
    if (guessRaw[i] === codeRaw[i]) {
      blk++;
      if (blk > expected.blk) return null;
    } else {
      guessCount.set(guessRaw[i], (guessCount.get(guessRaw[i]) || 0) + 1);
      codeCount.set(codeRaw[i], (codeCount.get(codeRaw[i]) || 0) + 1);
    }
  }

  for (const [k, v] of guessCount) {
    if (codeCount.has(k)) {
      wht += Math.min(v, codeCount.get(k));
      if (blk + wht > expected.blk + expected.wht) return null;
    }
  }

  return { blk, wht };
}
function* digitArraysFrom(start, pool) {
  const arr = start.slice();
  if (!increment(arr, pool)) return;

  while (true) {
    yield arr.slice();
    if (!increment(arr, pool)) return;
  }
}

function increment(arr, pool) {
  const base = pool.length;
  let i = arr.length - 1;

  while (i >= 0) {
   if (arr[i] < base - 1) {
      arr[i]++;
      return true;
    }
    arr[i] = 0;
    i--;
  }
  return false;
}
function isPossible(testRaw, testFeedback) {
  for (const { guess, feedback } of testFeedback) {
    const expected = {
      blk: Number(feedback.blk),
      wht: Number(feedback.wht)
    };

    const s = scoreFast(guess, testRaw, expected);

    if (s === null) return false;

    // Final exact check (scoreFast may early-exit before full count)
    if (s.blk !== expected.blk || s.wht !== expected.wht) {
      return false;
    }
  }
  return true;
}

function getNextUniquePermutation([array, guessed, restraints]) {
  let bestResult = [];
  let lowestScore = Infinity;
  let found = false;
  const nums = [...array].sort(); // sort to group duplicates
  const used = Array(nums.length).fill(false);

  function squaredDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return sum;
  }
  function rmsError(candidate, tests) {
    let error = 0;
    for (const { guess, rms } of tests) {
      const g = guess.split("").map(Number);
      const sse = squaredDistance(candidate, g);
      const expected = rms * rms * candidate.length;
      error += Math.abs(sse - expected);
    }
    return error
  }

  function backtrack(current) {
    if (current.length === nums.length) {
      if (guessed.has(current.join(","))) return;
      if (restraints.length === 0) {
        bestResult = current.slice();
        found = true;
        return;
      }
      else {
        const testScore = rmsError(current, restraints);
        if (testScore < lowestScore) {
          //We need to save memory.  No slicing here.
          for (let i = 0; i < current.length; i++)
            bestResult[i] = current[i];
          lowestScore = testScore;
          return;
        }
      }
    }
    for (let i = 0; i < nums.length; i++) {
      // Skip already-used elements
      if (used[i]) continue;
      // Skip duplicates:
      // only allow the first unused instance
      if (i > 0 && nums[i] === nums[i - 1] && !used[i - 1]) continue;
      used[i] = true;
      current.push(nums[i]);
      backtrack(current);
      if (restraints.length === 0 && found) break
      current.pop();
      used[i] = false;
    };
  };
  backtrack([]);
  return bestResult;
}
// ==============================
// PIX BLACK-ONLY MULTISET SOLVER
// ==============================
function pixGetNextCode([tested, testFeedback, lastGuessRaw, pool, cursorRaw, timeBudgetMs]) {
  const sortedPool = pool.slice().sort((a, b) => a - b);
  const length = sortedPool.length;
  const candidate = new Array(length);
  const deadline = Date.now() + Math.max(50, Number(timeBudgetMs) || 1000);
  const TIMEOUT = { timeout: true };

  // Build multiset
  const values = [];
  const counts = [];
  for (const v of sortedPool) {
    const i = values.indexOf(v);
    if (i === -1) {
      values.push(v);
      counts.push(1);
    } else {
      counts[i]++;
    }
  }

  let checked = 0;
  let sawTestedCandidate = false;
  let lastChecked = [];

  function hasSameMultiset(candidateRaw) {
    if (!Array.isArray(candidateRaw) || candidateRaw.length !== length) return false;
    const remaining = new Map();
    for (const v of sortedPool) remaining.set(v, (remaining.get(v) || 0) + 1);
    for (const v of candidateRaw) {
      const count = remaining.get(v) || 0;
      if (count <= 0) return false;
      remaining.set(v, count - 1);
    }
    for (const count of remaining.values()) if (count !== 0) return false;
    return true;
  }

  const cursor = hasSameMultiset(cursorRaw)
    ? cursorRaw.slice()
    : hasSameMultiset(lastGuessRaw)
      ? lastGuessRaw.slice()
      : null;
  if (cursor) lastChecked = cursor.slice();
  const valueIndexByKey = new Map();
  for (let i = 0; i < values.length; i++) valueIndexByKey.set(values[i], i);
  const openCountsScratch = new Array(values.length).fill(0);
  const feedbackConstraints = testFeedback.map(({ guess, feedback }) => ({
    guess,
    required: Number(feedback.blk)
  }));

  function maxRemainingExactMatches(guess, pos) {
    openCountsScratch.fill(0);
    for (let i = pos; i < length; i++) {
      const valueIndex = valueIndexByKey.get(guess[i]);
      if (valueIndex !== undefined) openCountsScratch[valueIndex]++;
    }
    let max = 0;
    for (let i = 0; i < values.length; i++) {
      max += Math.min(counts[i], openCountsScratch[i]);
    }
    return max;
  }

  function updatePrunedCursor(pos) {
    const pruned = candidate.slice(0, pos);
    for (let i = values.length - 1; i >= 0; i--) {
      for (let count = 0; count < counts[i]; count++) pruned.push(values[i]);
    }
    lastChecked = pruned;
  }

  function candidateMatchesFeedback(testRaw) {
    for (const { guess, required } of feedbackConstraints) {
      let blk = 0;
      for (let i = 0; i < length; i++) {
        if (testRaw[i] === guess[i]) blk++;
      }
      if (blk !== required) return false;
    }
    return true;
  }

  function dfs(pos, cursorRelation) {
    if (Date.now() > deadline) return TIMEOUT;

    for (const constraint of feedbackConstraints) {
      const { guess, required } = constraint;
      let blk = 0;
      for (let i = 0; i < pos; i++) {
        if (candidate[i] === guess[i]) blk++;
      }

      // Upper bound: too many matches already
      if (blk > required) {
        updatePrunedCursor(pos);
        return null;
      }

      // Lower bound: cannot possibly reach required matches
      if (blk + maxRemainingExactMatches(guess, pos) < required) {
        updatePrunedCursor(pos);
        return null;
      }
    }

    if (pos === length) {
      if (cursor && cursorRelation !== 1) return null;
      checked++;
      lastChecked = candidate.slice();
      const key = candidate.join(",");

      if (!candidateMatchesFeedback(candidate)) return null;
      if (tested.has(key)) {
        sawTestedCandidate = true;
        return null;
      }
      return candidate.slice();
    }

    for (let i = 0; i < values.length; i++) {
      if (counts[i] === 0) continue;
      const value = values[i];
      let nextCursorRelation = cursorRelation;
      if (cursor && cursorRelation === 0) {
        if (value < cursor[pos]) continue;
        if (value > cursor[pos]) nextCursorRelation = 1;
      }
      candidate[pos] = value;
      counts[i]--;
      const result = dfs(pos + 1, nextCursorRelation);
      if (result === TIMEOUT || result) {
        counts[i]++;
        return result;
      }
      updatePrunedCursor(pos + 1);
      counts[i]++;
    }
    return null;
  }

  function validateFeedbackAgainstPool(pool, testFeedback) {
    const poolCounts = {};
    for (const v of pool) {
      poolCounts[v] = (poolCounts[v] || 0) + 1;
    }
    for (const { guess } of testFeedback) {
      const guessCounts = {};
      for (const v of guess) {
        guessCounts[v] = (guessCounts[v] || 0) + 1;
      }
      for (const k in guessCounts) {
        if (!poolCounts[k] || guessCounts[k] > poolCounts[k]) {
          throw new Error(
            "Feedback guess contains symbols not compatible with pool"
          );
        }
      }
    }
  }
  validateFeedbackAgainstPool(sortedPool, testFeedback);
  const result = dfs(0, cursor ? 0 : 1);
  if (result === TIMEOUT) {
    return { guess: null, cursor: lastChecked.slice(), checked, exhausted: false, sawTestedCandidate };
  }
  if (!result) {
    return { guess: null, cursor: lastChecked.slice(), checked, exhausted: true, sawTestedCandidate };
  }
  return { guess: result, cursor: result.slice(), checked, exhausted: false, sawTestedCandidate };
}
const workerEntryPoints = Object.freeze({
  pixGetNextCode,
  getNextCandidate,
  getNextCode,
  getNextUniquePermutation,
});

onmessage = (event) => {
  if (event.data?.type === "reset") {
    postMessage({ type: "reset-complete" })
    return
  }
  try {
    const [entryPoint, payload] = Array.isArray(event.data) ? event.data : [];
    const handler = workerEntryPoints[entryPoint];

    if (typeof handler !== "function") {
      postMessage(null);
      return;
    }

    postMessage([handler(payload)]);
  } catch {
    postMessage(null); // always return something
  }
};
`;
const blob = new Blob([workerCode], { type: "application/javascript" })
//Ram dodged functions below and their file writes
async function proxyHome(ns, func, ...argmnts) { return await runIt(ns, "SphyxOS/extras/nsProxy.js", [func, ...argmnts], ns.getFunctionRamCost(func) + 1.6, 1, true) }
async function proxyLocal(ns, useMaxThreads, func, ...argmnts) { return await runIt(ns, "SphyxOS/extras/nsProxy.js", [func, ...argmnts], ns.getFunctionRamCost(func) + 1.6, useMaxThreads) }
async function proxyAuth(ns, useMaxThreads, server, password, func, ...argmnts) { return await runIt(ns, "SphyxOS/darknet/nsProxyAuth.js", [server, password, func, ...argmnts], ns.getFunctionRamCost(func) + 1.6 + 0.05, useMaxThreads) }
async function proxyHeartbleed(ns, server, logs, maxThreads, additionalMsec) { return await runIt(ns, "SphyxOS/darknet/heartbleed.js", ["dnet.heartbleed", server, logs, additionalMsec], ns.getFunctionRamCost("dnet.heartbleed") + 1.6, maxThreads) }
async function runCCT(ns, server, ...argmnts) {
  ns.atExit(() => {
    workingOnCCT = false
  })
  await runIt(ns, cctFile, [server, ...argmnts], 1.3 + 0.2 + 1.6, 1, "home")
  workingOnCCT = false
  ns.atExit(() => { })
}
/** @param {NS} ns */
async function runIt(ns, script, argmts, scriptOverride, useMaxThreads = true, onHome = false) {
  let threads = isNumeric(useMaxThreads) ? useMaxThreads : onHome ? 1 : Math.floor((await proxyHome(ns, "getServerMaxRam", onHome ? "home" : ns.self().server) - await proxyHome(ns, "getServerUsedRam", onHome ? "home" : ns.self().server)) / scriptOverride)
  if (useMaxThreads === "split") {
    let lastPid = 0
    const pidsUsed = []
    while (threads--) { //If you do --threads here it will reach 0 to fast.
      lastPid = ns.exec(script, ns.self().server, { ramOverride: scriptOverride, threads: 1, temporary: true }, ...argmts)
      if (lastPid === 0) {
        throw new Error(ns.self().server + " Failed to run " + script)
      }
      pidsUsed.push(lastPid)
    }
    await ns.nextPortWrite(lastPid)
    const results = await readQueuedPort(ns, lastPid)
    pidsUsed.forEach(p => ns.clearPort(p))
    return results
  }
  const thisPid = ns.exec(script, onHome ? "home" : ns.self().server, { ramOverride: scriptOverride, threads: threads, temporary: true }, ...argmts)
  if (thisPid === 0) {
    throw new Error(ns.self().server + " Failed to run " + script)
  }
  return await readQueuedPort(ns, thisPid)
}
/** @param {NS} ns */
async function getMaxAuthThreads(ns, heartBleed = false, server = ns.self().server) {
  const serverRam = await proxyHome(ns, "getServerMaxRam", server) - await proxyHome(ns, "getServerUsedRam", server)
  const cost = heartBleed ? ns.getFunctionRamCost("dnet.heartbleed") + 1.6 : ns.getFunctionRamCost("dnet.authenticate") + 1.6
  return Math.floor(serverRam / cost)
}
function writeProxyLocal(ns) {
  const data = `/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  let [func, ...argmnts] = ns.args
  let nsFunction = ns
  for (let prop of func.split(".")) nsFunction = nsFunction[prop]
  let finalResult
  try {
    const result = nsFunction(...argmnts)
    if (result instanceof Promise) finalResult = await result
    else if (result instanceof Object) {
      promiseRemoval(result)
      finalResult = result
    }
    else finalResult = result
  } catch { } //finalResult is undefined if it failed to run.
  ns.atExit(() => ns.writePort(ns.pid, finalResult))
}
function promiseRemoval(object) {
  for (const key in object)
    if (object[key] instanceof Promise) delete object[key]
    else if (object[key] instanceof Object) promiseRemoval(object[key])
}`
  ns.write("SphyxOS/extras/nsProxy.js", data, "w")
}

function writeProxyHeartbleed(ns) {
  const data = `/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  const result = await ns.dnet.heartbleed(ns.args[1], { logsToCapture: ns.args[2], additionalMsec: ns.args[3] })
  ns.atExit(() => ns.writePort(ns.pid, result))
}`
  ns.write("SphyxOS/darknet/heartbleed.js", data, "w")
}
function writeProxyAuth(ns) {
  const data = `/** @param {NS} ns */
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
}`
  ns.write("SphyxOS/darknet/nsProxyAuth.js", data, "w")
}
const easyHacks = ["DeskMemo_3.1", "ZeroLogon", "FreshInstall_1.0", "CloudBlare(tm)", "Laika4", "OctantVoxel", "Pr0verFl0", "110100100", "PrimeTime 2", "MathML", "OrdoXenos", "(The Labyrinth)"]
const midHacks = ["OpenWebAccessPoint", "EuroZone Free", "TopPass"]
const hardHacks = ["BellaCuore", "RateMyPix.Auth", "BigMo%od", "Factori-Os", "AccountsManager_4.2", "NIL", "DeepGreen", "PHP 5.4", "2G_cellular", "KingOfTheHill"]


const connectFailures = ["Not Enough Charisma", "Direct Connection Required", "Service Unavailable", "Not Found", "Request Timeout"]
const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const lettersLCase = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]
const lettersUCase = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
const euCountries =
  ["Austria", "Belgium", "Bulgaria", "Croatia", "Republic of Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
    "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"]
const smallPrimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97]
const largePrimes = [
  1069, 1409, 1471, 1567, 1597, 1601, 1697, 1747, 1801, 1889, 1979, 1999, 2063, 2207, 2371, 2503, 2539, 2693, 2741,
  2753, 2801, 2819, 2837, 2909, 2939, 3169, 3389, 3571, 3761, 3881, 4217, 4289, 4547, 4729, 4789, 4877, 4943, 4951,
  4957, 5393, 5417, 5419, 5441, 5519, 5527, 5647, 5779, 5881, 6007, 6089, 6133, 6389, 6451, 6469, 6547, 6661, 6719,
  6841, 7103, 7549, 7559, 7573, 7691, 7753, 7867, 8053, 8081, 8221, 8329, 8599, 8677, 8761, 8839, 8963, 9103, 9199,
  9343, 9467, 9551, 9601, 9739, 9749, 9859]
const commonPWDict =
  ["123456", "password", "12345678", "qwerty", "123456789", "12345", "1234", "111111", "1234567", "dragon", "123123", "baseball", "abc123", "football", "monkey", "letmein",
    "696969", "shadow", "master", "666666", "qwertyuiop", "123321", "mustang", "1234567890", "michael", "654321", "superman", "1qaz2wsx", "7777777", "121212", "0", "qazwsx",
    "123qwe", "trustno1", "jordan", "jennifer", "zxcvbnm", "asdfgh", "hunter", "buster", "soccer", "harley", "batman", "andrew", "tigger", "sunshine", "iloveyou", "2000",
    "charlie", "robert", "thomas", "hockey", "ranger", "daniel", "starwars", "112233", "george", "computer", "michelle", "jessica", "pepper", "1111", "zxcvbn", "555555",
    "11111111", "131313", "freedom", "777777", "pass", "maggie", "159753", "aaaaaa", "ginger", "princess", "joshua", "cheese", "amanda", "summer", "love", "ashley", "6969",
    "nicole", "chelsea", "biteme", "matthew", "access", "yankees", "987654321", "dallas", "austin", "thunder", "taylor", "matrix"]
/** @param {NS} ns */
async function getCommands(ns) {
  while (true) {
    let silent = false
    while (ns.peek(25) !== "NULL PORT DATA") {
      let result = ns.readPort(25)
      if (result?.syms) {
        if (!silent) {
          if (modeStock === "none" && result.syms.length > 0) ns.tprintf("DarkNet will now push stocks.")
          else if (modeStock !== "none" && modeStock.length > 0 && result.syms.length === 0) ns.tprintf("DarkNet will stop pushing stocks.")
        }
        modeStock = result.syms.length === 0 ? "none" : result.syms
        continue
      }
      switch (result) {
        case "silent":
          silent = true
          break;
        case "phishingOn":
          if (!silent) ns.tprintf("DarkNet is now Phishing")
          modePhishing = true
          break
        case "phishingOff":
          if (!silent) ns.tprintf("DarkNet has stopped Phishing")
          modePhishing = false
          break
        case "inducingOn":
          if (!silent) ns.tprintf("DarkNet is now Inducing Migrations")
          modeInduce = true
          break
        case "inducingOff":
          if (!silent) ns.tprintf("DarkNet has stopped Inducing Migrations")
          modeInduce = false
          break
        case "sharingOn":
          if (!silent) ns.tprintf("DarkNet is now Sharing RAM")
          modeShare = true
          break
        case "sharingOff":
          if (!silent) ns.tprintf("DarkNet has stopped Sharing RAM")
          modeShare = false
          break
        case "showmapOn":
          if (!silent) ns.tprintf("DarkNet will now show the Lab map")
          modeShowMap = true
          if (labName) startMapDisplay(ns)
          break
        case "showmapOff":
          if (!silent) ns.tprintf("DarkNet will stop showing the Lab map")
          modeShowMap = false
          ns.ui.closeTail()
          break
        case "stormOn":
          if (!silent) ns.tprintf("DarkNet will now attempt to start a webstorm")
          modeStorm = true
          break
        case "stormOff":
          if (!silent) ns.tprintf("DarkNet will no longer attempt to start a webstorm")
          modeStorm = false
          break
        default:
          ns.tprintf("Invalid command received in darknet: %s", result)
          break;
      }
    }
    //Look into mutation observers: https://developer.mozilla.org/en-US/docs/web/api/mutationobserver
    if (!logOpened && labName && modeShowMap && ns.self().tailProperties === null) {
      startMapDisplay(ns)
    }
    else if (logOpened && labName && modeShowMap && ns.self().tailProperties === null) {
      modeShowMap = false
      logOpened = false
      ns.writePort(1, "darknet map off")
    }
    await ns.asleep(200)
  }
}
// ----- Configuration --------------------------------------------------------
let labName = false
const labWalkStepChunk = 1
const refreshMs = 200
const cellSize = 15
const cellGap = 2
const labWorkerScriptPath = "SphyxOS/darknet/labHunter.js"

// Lab map characters (display + auth-data parsing).
const labMapFill = "█"
const labMapPossibleHall = "·"
const labMapUnknownRoom = labMapPossibleHall
const labMapOpen = " "
const labMapStart = "S"
const labMapFinish = "X"
const labMapWorker = "o"
const labCurrentRoomCommand = "nothing"

// Direction table.  Movement is on a 2-step grid so walls / hallways live on
// the odd offsets between rooms.
const labDirections = {
  north: { dx: 0, dy: -2, back: "south" },
  south: { dx: 0, dy: 2, back: "north" },
  east: { dx: 2, dy: 0, back: "west" },
  west: { dx: -2, dy: 0, back: "east" }
}
const labDirectionEntries = Object.entries(labDirections)
const labDirectionIndex = { north: 0, east: 1, south: 2, west: 3 }
const labPackedCoordOffset = 4096
const labPackedCoordSpan = labPackedCoordOffset * 2
const labEndpointOffsetChoices = 3
const labEndpointOffsetStep = 2
const labEndpointMaxOffset = labEndpointOffsetStep * (labEndpointOffsetChoices - 1)
const labDeadAreaDrainBudget = 32

// Maze dimensions keyed by required charisma level (Bitburner labyrinth tiers).
const labDimensionsByCha = {
  300: { mazeWidth: 20, mazeHeight: 14, offsetStartAndEnd: false },
  600: { mazeWidth: 30, mazeHeight: 20, offsetStartAndEnd: false },
  1500: { mazeWidth: 40, mazeHeight: 26, offsetStartAndEnd: false },
  2500: { mazeWidth: 60, mazeHeight: 40, offsetStartAndEnd: true },
  3000: { mazeWidth: 60, mazeHeight: 40, offsetStartAndEnd: true },
  3500: { mazeWidth: 60, mazeHeight: 40, offsetStartAndEnd: true },
  4000: { mazeWidth: 60, mazeHeight: 40, offsetStartAndEnd: true }
}

// ----- Module state ---------------------------------------------------------
// labState holds all the per-labyrinth data.  Reset by ensureLabState when
// the case block is entered with a new server name.
let labState = null
let labComplete = false
let labWorkerVisitStack = new Map()  // workerId -> string[]
let labWorkerQuadrantCommit = new Map()  // workerId -> committed secondary quadrant key
let labInfluenceContextCache = new WeakMap()
let labQuadrantBoundsCoordCache = new WeakMap()
let labGoalwardDirsCache = new WeakMap()
let labCoordParseCache = new Map()

// ----- Coord and key helpers ------------------------------------------------
function getLabKey(x, y) { return `${x},${y}` }
function getLabCoordsFromKey(key) {
  if (typeof key !== "string") return null
  const cached = labCoordParseCache.get(key)
  if (cached) return cached
  const comma = key.indexOf(",")
  if (comma <= 0 || comma !== key.lastIndexOf(",")) return null
  const x = Number(key.slice(0, comma))
  const y = Number(key.slice(comma + 1))
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null
  const coords = [x, y]
  labCoordParseCache.set(key, coords)
  return coords
}


// ----- Auth-result parsing — the "new worker" pattern -----------------------
// Every move goes through ns.dnet.authenticate(server, dir).  The response
// includes a message ("You have moved to X, Y." / "You are still at X, Y.")
// and a data string that is the maze ASCII with an "@" marker on the
// worker's current cell.  We parse coords from the message and the four
// exit walls from the cells immediately around "@".  No separate
// currentRoom command is needed for normal walking.
function getLabRawCoordsFromAuthResult(result) {
  const message = typeof result?.message === "string" ? result.message : ""
  let idx = message.indexOf("You have moved to")
  if (idx >= 0) idx += 17
  else {
    idx = message.indexOf("You are still at")
    if (idx >= 0) idx += 16
  }
  if (idx < 0) return null
  const parseNumber = () => {
    while (idx < message.length && message.charCodeAt(idx) <= 32) idx++
    let sign = 1
    if (message[idx] === "-") { sign = -1; idx++ }
    let value = 0
    let sawDigit = false
    while (idx < message.length) {
      const code = message.charCodeAt(idx)
      if (code < 48 || code > 57) break
      value = value * 10 + code - 48
      sawDigit = true
      idx++
    }
    return sawDigit ? value * sign : null
  }
  const rawX = parseNumber()
  while (idx < message.length && (message.charCodeAt(idx) <= 32 || message[idx] === ",")) idx++
  const rawY = parseNumber()
  if (!Number.isInteger(rawX) || !Number.isInteger(rawY)) return null
  return [rawX, rawY]
}
// ----- Coord translation ----------------------------------------------------
// Bitburner already reports all workers in one native maze coordinate frame.
function getLabActualCoords(x, y, report, state = null) {
  if (Array.isArray(report?.coords) && Number.isInteger(report.coords[0]) && Number.isInteger(report.coords[1])) {
    return [report.coords[0], report.coords[1]]
  }
  return [x, y]
}
function sanitizeLabRoomExits(state, x, y, exits) {
  // Force walls at the layout boundary so the picker can't plan a step
  // outside the maze rectangle. Bitburner reports native maze coords; even
  // offset starts and endpoints remain inside this positive coordinate frame.
  const cleanExits = { ...exits }
  if (!state?.layout) return cleanExits
  if (x <= state.layout.minX) cleanExits.west = false
  if (y <= state.layout.minY) cleanExits.north = false
  if (x >= state.layout.maxX) cleanExits.east = false
  if (y >= state.layout.maxY) cleanExits.south = false
  return cleanExits
}
function getLabMoveCoords(currentX, currentY, expectedX, expectedY, report, state = null) {
  const [actualX, actualY] = getLabActualCoords(expectedX, expectedY, report, state)
  if (actualX === currentX && actualY === currentY) return { status: "blocked", x: currentX, y: currentY }
  if (actualX === expectedX && actualY === expectedY) return { status: "moved", x: expectedX, y: expectedY }
  return { status: "mismatch", x: currentX, y: currentY, reportedX: actualX, reportedY: actualY }
}

// ----- Layout ---------------------------------------------------------------
function getLabDimensions(chaReq) {
  if (!Number.isFinite(chaReq)) return null
  const tiers = Object.keys(labDimensionsByCha).map(Number).sort((a, b) => a - b)
  let chosen = null
  for (const tier of tiers) if (chaReq <= tier) { chosen = tier; break }
  if (chosen === null) chosen = tiers[tiers.length - 1]
  return labDimensionsByCha[chosen]
}
function getEstimatedLabLayout(chaReq) {
  const dim = getLabDimensions(chaReq)
  if (!dim) return null
  const width = dim.mazeWidth + 1
  const height = dim.mazeHeight + 1
  const maxX = width - 2
  const maxY = height - 2
  return {
    startX: 1, startY: 1,
    minX: 1, minY: 1,
    maxX, maxY,
    finishX: null, finishY: null,
    goalX: maxX, goalY: maxY,
    offsetStartAndEnd: dim.offsetStartAndEnd === true
  }
}
function getLabDisplayLayoutKey(layout) {
  if (!layout) return ""
  return [layout.minX, layout.minY, layout.maxX, layout.maxY, layout.goalX, layout.goalY, layout.offsetStartAndEnd === true ? 1 : 0].join(":")
}

// ----- Influence context + goalward direction logic -------------------------
// Drives "which direction(s) are goalward from (x, y)?".  Before a
// quadrant boundary is crossed, movement that keeps the worker attached
// to that target wall is goalward.  After crossing, that old boundary is
// no longer goalward; the next target is the exit quadrant/subquadrant.
// Cached per-(state, signature, x, y).
function getLabQuadrantSide(value, midpoint) { return value >= midpoint ? 1 : -1 }
function getLabQuadrantKeyFromSides(sideX, sideY) { return `${sideX},${sideY}` }
function getLabInfluenceContext(state) {
  const layout = state?.layout
  if (!layout || ![layout.minX, layout.minY, layout.maxX, layout.maxY].every(Number.isFinite)) return null
  const layoutKey = getLabDisplayLayoutKey(layout)
  const cached = labInfluenceContextCache.get(state)
  if (cached?.layoutKey === layoutKey) return cached.context
  const midX = (layout.minX + layout.maxX) / 2
  const midY = (layout.minY + layout.maxY) / 2
  const startX = Number.isFinite(layout.startX) ? layout.startX : layout.minX
  const startY = Number.isFinite(layout.startY) ? layout.startY : layout.minY
  const goalX = Number.isFinite(layout.goalX) ? layout.goalX : layout.maxX
  const goalY = Number.isFinite(layout.goalY) ? layout.goalY : layout.maxY
  const startSideX = getLabQuadrantSide(startX, midX)
  const startSideY = getLabQuadrantSide(startY, midY)
  const goalSideX = getLabQuadrantSide(goalX, midX)
  const goalSideY = getLabQuadrantSide(goalY, midY)
  const exitTargetX = goalSideX === 1 ? layout.maxX : layout.minX
  const exitTargetY = goalSideY === 1 ? layout.maxY : layout.minY
  const context = {
    state, layout, midX, midY, startX, startY, goalX, goalY,
    startSideX, startSideY, goalSideX, goalSideY, exitTargetX, exitTargetY,
    signature: `${layoutKey}:${startSideX}:${startSideY}:${goalSideX}:${goalSideY}:${goalX}:${goalY}`
  }
  labInfluenceContextCache.set(state, { layoutKey, context })
  return context
}
function getLabInfluenceSignature(context) {
  return typeof context?.signature === "string" ? context.signature : ""
}
function getLabQuadrantBounds(sideX, sideY, context) {
  const layout = context?.layout
  if (!layout || ![-1, 1].includes(sideX) || ![-1, 1].includes(sideY)) return null
  const xParity = ((layout.startX ?? 1) & 1)
  const yParity = ((layout.startY ?? 1) & 1)
  const rightMinX = context.midX + (((context.midX & 1) === xParity) ? 0 : 1)
  const leftMaxX = rightMinX - 2
  const southMinY = context.midY + (((context.midY & 1) === yParity) ? 0 : 1)
  const northMaxY = southMinY - 2
  return {
    sideX, sideY,
    key: getLabQuadrantKeyFromSides(sideX, sideY),
    minX: sideX < 0 ? layout.minX : rightMinX,
    maxX: sideX < 0 ? leftMaxX : layout.maxX,
    minY: sideY < 0 ? layout.minY : southMinY,
    maxY: sideY < 0 ? northMaxY : layout.maxY
  }
}
function getLabQuadrantBoundsForCoords(x, y, context) {
  if (!context) return null
  const state = context.state
  const sideX = getLabQuadrantSide(x, context.midX)
  const sideY = getLabQuadrantSide(y, context.midY)
  if (!state) return getLabQuadrantBounds(sideX, sideY, context)
  const signature = getLabInfluenceSignature(context)
  let cache = labQuadrantBoundsCoordCache.get(state)
  if (!cache || cache.signature !== signature) {
    cache = { signature, map: new Map() }
    labQuadrantBoundsCoordCache.set(state, cache)
  }
  const key = getLabKey(x, y)
  if (!cache.map.has(key)) cache.map.set(key, getLabQuadrantBounds(sideX, sideY, context))
  return cache.map.get(key)
}
function getLabEndpointOffsetMax(context) {
  const layout = context?.layout
  return layout?.offsetStartAndEnd === true ? labEndpointMaxOffset : 0
}
function getLabEndpointRange(anchor, inward, minLimit, maxLimit, parity, maxOffset) {
  if (!Number.isInteger(anchor) || ![-1, 1].includes(inward)) return null
  let min = Math.max(minLimit, Math.min(anchor, anchor + inward * maxOffset))
  let max = Math.min(maxLimit, Math.max(anchor, anchor + inward * maxOffset))
  while (min <= max && (min & 1) !== parity) min++
  while (max >= min && (max & 1) !== parity) max--
  return min <= max ? { min, max } : null
}
function isLabRoomParity(x, y, context) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false
  const xParity = ((context?.layout?.startX ?? 1) & 1)
  const yParity = ((context?.layout?.startY ?? 1) & 1)
  return (x & 1) === xParity && (y & 1) === yParity
}
// Bounds of the "exit sub-quadrant" — the half of the goal quadrant that
// hugs the actual exit corner.  The exit cell itself plus every cell on a
// path that ENDS in this region must remain discoverable; unexplored
// frontier cells stay protected, while explored cul-de-sacs can still be
// marked dead so workers do not bounce inside the exit area.
function getLabExitSubquadrantBounds(context) {
  // Protected endpoint footprint only: official offsets are 0, 2, or 4.
  if (!context) return null
  const goalBounds = getLabQuadrantBounds(context.goalSideX, context.goalSideY, context)
  if (!goalBounds) return null
  const xParity = ((context.layout?.startX ?? 1) & 1)
  const yParity = ((context.layout?.startY ?? 1) & 1)
  const maxOffset = getLabEndpointOffsetMax(context)
  const inwardX = context.goalSideX > 0 ? -1 : 1
  const inwardY = context.goalSideY > 0 ? -1 : 1
  const xRange = getLabEndpointRange(context.exitTargetX, inwardX, goalBounds.minX, goalBounds.maxX, xParity, maxOffset)
  const yRange = getLabEndpointRange(context.exitTargetY, inwardY, goalBounds.minY, goalBounds.maxY, yParity, maxOffset)
  if (!xRange || !yRange) return null
  const minX = xRange.min, maxX = xRange.max, minY = yRange.min, maxY = yRange.max
  return { minX, maxX, minY, maxY }
}
function isLabInExitSubquadrant(x, y, context) {
  const bounds = getLabExitSubquadrantBounds(context)
  if (!bounds) return false
  return isLabRoomParity(x, y, context)
    && x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
}
function getLabStartSubquadrantBounds(context) {
  // Protected start footprint only: official offsets are 0, 2, or 4.
  if (!context) return null
  const startBounds = getLabQuadrantBounds(context.startSideX, context.startSideY, context)
  if (!startBounds) return null
  const xParity = ((context.layout?.startX ?? 1) & 1)
  const yParity = ((context.layout?.startY ?? 1) & 1)
  const maxOffset = getLabEndpointOffsetMax(context)
  const inwardX = context.startSideX < 0 ? 1 : -1
  const inwardY = context.startSideY < 0 ? 1 : -1
  const xRange = getLabEndpointRange(context.startX, inwardX, startBounds.minX, startBounds.maxX, xParity, maxOffset)
  const yRange = getLabEndpointRange(context.startY, inwardY, startBounds.minY, startBounds.maxY, yParity, maxOffset)
  if (!xRange || !yRange) return null
  const minX = xRange.min, maxX = xRange.max, minY = yRange.min, maxY = yRange.max
  return { minX, maxX, minY, maxY }
}
function isLabInStartSubquadrant(x, y, context) {
  const bounds = getLabStartSubquadrantBounds(context)
  if (!bounds) return false
  return isLabRoomParity(x, y, context)
    && x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
}
function isLabInExitQuadrant(x, y, context) {
  const bounds = getLabQuadrantBoundsForCoords(x, y, context)
  return Boolean(bounds && bounds.sideX === context?.goalSideX && bounds.sideY === context?.goalSideY)
}
function isLabInStartQuadrant(x, y, context) {
  const bounds = getLabQuadrantBoundsForCoords(x, y, context)
  return Boolean(bounds && bounds.sideX === context?.startSideX && bounds.sideY === context?.startSideY)
}
function getLabExitFocusPointRank(state, x, y, context = getLabInfluenceContext(state)) {
  if (!context) return 0
  if (!isLabInExitQuadrant(x, y, context)) return 3
  return isLabInExitSubquadrant(x, y, context) ? 0 : 1
}
function getLabExitFocusMoveRank(state, fromX, fromY, toX, toY, context = getLabInfluenceContext(state)) {
  if (!context || !isLabInExitQuadrant(fromX, fromY, context)) return 0
  return getLabExitFocusPointRank(state, toX, toY, context)
}
function isLabQuadrantCrossing(state, fromX, fromY, toX, toY, context = getLabInfluenceContext(state)) {
  if (!context) return false
  const fromBounds = getLabQuadrantBoundsForCoords(fromX, fromY, context)
  const toBounds = getLabQuadrantBoundsForCoords(toX, toY, context)
  if (!fromBounds || !toBounds) return false
  return fromBounds.key !== toBounds.key
}
function isLabSameQuadrantMove(state, fromX, fromY, toX, toY, context = getLabInfluenceContext(state)) {
  if (!context) return true
  const fromBounds = getLabQuadrantBoundsForCoords(fromX, fromY, context)
  const toBounds = getLabQuadrantBoundsForCoords(toX, toY, context)
  return Boolean(fromBounds && toBounds && fromBounds.key === toBounds.key)
}
function isLabSameQuadrantCell(state, anchorX, anchorY, x, y, context = getLabInfluenceContext(state)) {
  return isLabSameQuadrantMove(state, anchorX, anchorY, x, y, context)
}
function getLabEdgeKey(x, y, dir) {
  const delta = labDirections[dir]
  if (!delta || !Number.isInteger(x) || !Number.isInteger(y)) return ""
  const a = getLabKey(x, y)
  const b = getLabKey(x + delta.dx, y + delta.dy)
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
function getLabQuadrantTransitionKey(state, fromX, fromY, toX, toY, context = getLabInfluenceContext(state)) {
  if (!context) return ""
  const fromBounds = getLabQuadrantBoundsForCoords(fromX, fromY, context)
  const toBounds = getLabQuadrantBoundsForCoords(toX, toY, context)
  if (!fromBounds || !toBounds || fromBounds.key === toBounds.key) return ""
  return fromBounds.key < toBounds.key ? `${fromBounds.key}|${toBounds.key}` : `${toBounds.key}|${fromBounds.key}`
}
function getLabQuadrantTransitionForDir(state, x, y, dir, context = getLabInfluenceContext(state)) {
  const delta = labDirections[dir]
  if (!delta) return null
  const nx = x + delta.dx
  const ny = y + delta.dy
  const transitionKey = getLabQuadrantTransitionKey(state, x, y, nx, ny, context)
  if (!transitionKey) return null
  return {
    transitionKey,
    edgeKey: getLabEdgeKey(x, y, dir),
    toX: nx,
    toY: ny
  }
}
function getLabStartQuadrantKey(context) {
  return context ? getLabQuadrantKeyFromSides(context.startSideX, context.startSideY) : ""
}
function getLabQuadrantGoalDistance(bounds, context) {
  if (!bounds || !context) return Infinity
  return (bounds.sideX === context.goalSideX ? 0 : 1) + (bounds.sideY === context.goalSideY ? 0 : 1)
}
function getLabQuadrantProgressRank(bounds, context) {
  const distance = getLabQuadrantGoalDistance(bounds, context)
  return Number.isFinite(distance) ? 2 - distance : -Infinity
}
function isLabMoreGoalwardQuadrantMove(state, fromX, fromY, toX, toY, context = getLabInfluenceContext(state)) {
  if (!context) return false
  const fromBounds = getLabQuadrantBoundsForCoords(fromX, fromY, context)
  const toBounds = getLabQuadrantBoundsForCoords(toX, toY, context)
  if (!fromBounds || !toBounds || fromBounds.key === toBounds.key) return false
  return getLabQuadrantProgressRank(toBounds, context) > getLabQuadrantProgressRank(fromBounds, context)
}
function isLabWorseQuadrantMove(state, fromX, fromY, toX, toY, context = getLabInfluenceContext(state)) {
  if (!context) return false
  const fromBounds = getLabQuadrantBoundsForCoords(fromX, fromY, context)
  const toBounds = getLabQuadrantBoundsForCoords(toX, toY, context)
  if (!fromBounds || !toBounds || fromBounds.key === toBounds.key) return false
  return getLabQuadrantProgressRank(toBounds, context) < getLabQuadrantProgressRank(fromBounds, context)
}
function getLabWorkerCommittedQuadrant(state, workerId, x, y, context = getLabInfluenceContext(state)) {
  if (!workerId || !context) return ""
  const committed = labWorkerQuadrantCommit.get(workerId)
  if (committed) return committed
  const bounds = getLabQuadrantBoundsForCoords(x, y, context)
  const startKey = getLabStartQuadrantKey(context)
  if (bounds && bounds.key !== startKey && getLabQuadrantGoalDistance(bounds, context) === 1) {
    labWorkerQuadrantCommit.set(workerId, bounds.key)
    return bounds.key
  }
  return ""
}
function rememberLabWorkerQuadrantCommit(state, workerId, fromX, fromY, toX, toY, context = getLabInfluenceContext(state)) {
  if (!workerId || !context) return false
  const fromBounds = getLabQuadrantBoundsForCoords(fromX, fromY, context)
  const toBounds = getLabQuadrantBoundsForCoords(toX, toY, context)
  if (!fromBounds || !toBounds || fromBounds.key === toBounds.key) return false
  const startKey = getLabStartQuadrantKey(context)
  if (fromBounds.key !== startKey || getLabQuadrantGoalDistance(toBounds, context) !== 1) return false
  if (labWorkerQuadrantCommit.get(workerId) === toBounds.key) return false
  labWorkerQuadrantCommit.set(workerId, toBounds.key)
  return true
}
function getLabWorkerQuadrantBlockReason(state, workerId, fromX, fromY, toX, toY, context = getLabInfluenceContext(state)) {
  const committed = getLabWorkerCommittedQuadrant(state, workerId, fromX, fromY, context)
  if (!committed || !context) return ""
  const fromBounds = getLabQuadrantBoundsForCoords(fromX, fromY, context)
  const toBounds = getLabQuadrantBoundsForCoords(toX, toY, context)
  if (!fromBounds || !toBounds || fromBounds.key === toBounds.key) return ""
  const startKey = getLabStartQuadrantKey(context)
  if (fromBounds.key === startKey && toBounds.key !== committed && getLabQuadrantGoalDistance(toBounds, context) === 1) {
    return "worker-secondary"
  }
  if (fromBounds.key === committed && toBounds.key === startKey) return "worker-retreat"
  if (fromBounds.key === committed && toBounds.key !== committed && getLabQuadrantGoalDistance(toBounds, context) === 1) {
    return "worker-secondary"
  }
  return ""
}
function isLabKnownGatewayQuadrantCrossing(state, x, y, dir, context = getLabInfluenceContext(state)) {
  const crossing = getLabQuadrantTransitionForDir(state, x, y, dir, context)
  if (!crossing) return false
  const gateway = ensureLabQuadrantGatewaySection(state)[crossing.transitionKey]
  return Boolean(gateway?.edgeKey && gateway.edgeKey === crossing.edgeKey)
}
function isLabLiveQuadrantCrossing(state, x, y, dir, context = getLabInfluenceContext(state)) {
  const delta = labDirections[dir]
  const crossing = getLabQuadrantTransitionForDir(state, x, y, dir, context)
  if (!delta || !crossing) return false
  const nx = x + delta.dx
  const ny = y + delta.dy
  if (!isLabMoreGoalwardQuadrantMove(state, x, y, nx, ny, context)) return false
  const gateway = ensureLabQuadrantGatewaySection(state)[crossing.transitionKey]
  return !(gateway?.edgeKey && gateway.edgeKey !== crossing.edgeKey)
}
function isLabKnownQuadrantGatewayCell(state, x, y) {
  if (!state || !Number.isInteger(x) || !Number.isInteger(y)) return false
  const key = getLabKey(x, y)
  for (const gateway of Object.values(ensureLabQuadrantGatewaySection(state))) {
    if (gateway?.fromKey === key || gateway?.toKey === key) return true
  }
  return false
}
function getLabQuadrantGatewaySignature(state) {
  if (!state) return ""
  return Object.entries(ensureLabQuadrantGatewaySection(state))
    .filter(([, gateway]) => gateway?.edgeKey)
    .map(([transitionKey, gateway]) => `${transitionKey}=${gateway.edgeKey}`)
    .sort()
    .join(";")
}
function getLabQuadrantTransitionCells(state, context = getLabInfluenceContext(state)) {
  const layout = state?.layout
  if (!layout || !context) return {}
  const signature = getLabInfluenceSignature(context)
  const cache = ensureLabQuadrantTransitionCellCache(state)
  if (cache.signature === signature && cache.byTransition && typeof cache.byTransition === "object") return cache.byTransition
  const byTransition = {}
  for (let y = layout.minY; y <= layout.maxY; y += 2) {
    for (let x = layout.minX; x <= layout.maxX; x += 2) {
      for (const [dir, delta] of labDirectionEntries) {
        const crossing = getLabQuadrantTransitionForDir(state, x, y, dir, context)
        if (!crossing) continue
        const entry = {
          x,
          y,
          dir,
          toX: crossing.toX,
          toY: crossing.toY,
          wallX: x + delta.dx / 2,
          wallY: y + delta.dy / 2,
          edgeKey: crossing.edgeKey,
          transitionKey: crossing.transitionKey
        }
        if (!Array.isArray(byTransition[crossing.transitionKey])) byTransition[crossing.transitionKey] = []
        byTransition[crossing.transitionKey].push(entry)
      }
    }
  }
  cache.signature = signature
  cache.byTransition = byTransition
  return byTransition
}
function applyLabQuadrantGatewayWalls(state, transitionKey = "") {
  if (!state?.rooms || !state.layout) return false
  const context = getLabInfluenceContext(state)
  if (!context) return false
  let changed = false
  const byTransition = getLabQuadrantTransitionCells(state, context)
  const transitionKeys = transitionKey ? [transitionKey] : Object.keys(byTransition)
  for (const key of transitionKeys) {
    const activeGateway = ensureLabQuadrantGatewaySection(state)[key]
    const entries = byTransition[key]
    if (!activeGateway?.edgeKey || !Array.isArray(entries)) continue
    for (const entry of entries) {
      if (entry.edgeKey === activeGateway.edgeKey) continue
      if (setLabDisplayCharAtCoords(state, entry.wallX, entry.wallY, labMapFill)) changed = true
    }
  }
  if (changed) {
    state.displayVersion = (state.displayVersion ?? 0) + 1
    state.displayOutputKey = ""
  }
  return changed
}
function refreshLabGatewayTransitionDeadKnowledge(state, transitionKey, context = getLabInfluenceContext(state)) {
  if (!state?.rooms || !transitionKey || !context) return false
  const entries = getLabQuadrantTransitionCells(state, context)[transitionKey]
  if (!Array.isArray(entries) || entries.length === 0) return false
  const routeGate = createLabMoveGate(state, { context })
  const seen = new Set()
  const deadFrontiers = []
  for (const entry of entries) {
    if (!entry || !Number.isInteger(entry.x) || !Number.isInteger(entry.y)) continue
    const key = getLabKey(entry.x, entry.y)
    if (seen.has(key)) continue
    seen.add(key)
    const room = state.rooms[key]
    if (!room || room.explored === true || isLabProtectedDeadAreaCell(state, entry.x, entry.y, context)) continue
    const cost = getLabPotentialGoalCost(state, entry.x, entry.y, routeGate, context, {
      allowStartSubquadrantExplored: true,
      boundQuadrant: true,
      forceRefresh: true,
      originX: entry.x,
      originY: entry.y
    })
    if (!Number.isFinite(cost)) deadFrontiers.push(entry)
  }
  let changed = false
  for (const entry of deadFrontiers) {
    const escapeDir = getLabKnownFrontierEscapeDir(state, entry.x, entry.y)
    if (appendLabDeadEndEntry(state, getLabKey(entry.x, entry.y), escapeDir)) changed = true
  }
  for (const key of seen) {
    const coords = getLabCoordsFromKey(key)
    if (!coords) continue
    if (evaluateLabFrontierLeavesAround(state, coords[0], coords[1])) changed = true
    enqueueLabDeadAreaAround(state, coords[0], coords[1], context)
    if (reevaluateLabDeadEnd(state, coords[0], coords[1])) changed = true
  }
  if (drainLabDeadAreaQueue(state, context)) changed = true
  return changed
}
function recordLabQuadrantGateway(state, x, y, dir, context = getLabInfluenceContext(state)) {
  const crossing = getLabQuadrantTransitionForDir(state, x, y, dir, context)
  if (!crossing) return false
  const gateways = ensureLabQuadrantGatewaySection(state)
  const existing = gateways[crossing.transitionKey]
  if (existing?.edgeKey) {
    applyLabQuadrantGatewayWalls(state, crossing.transitionKey)
    return false
  }
  gateways[crossing.transitionKey] = {
    edgeKey: crossing.edgeKey,
    fromKey: getLabKey(x, y),
    toKey: getLabKey(crossing.toX, crossing.toY),
    x,
    y,
    dir
  }
  applyLabQuadrantGatewayWalls(state, crossing.transitionKey)
  refreshLabGatewayTransitionDeadKnowledge(state, crossing.transitionKey, context)
  return true
}
function recordLabQuadrantGatewaysFromExits(state, x, y, exits, context = getLabInfluenceContext(state)) {
  if (!state || !exits) return false
  let changed = false
  for (const [dir] of labDirectionEntries) {
    if (exits[dir] === true && recordLabQuadrantGateway(state, x, y, dir, context)) changed = true
  }
  return changed
}
function getLabGoalwardDirsForQuadrant(bounds, context) {
  if (!bounds || !context) return []
  const dirs = []
  if (bounds.sideX !== context.goalSideX) dirs.push(context.goalSideX > bounds.sideX ? "east" : "west")
  if (bounds.sideY !== context.goalSideY) dirs.push(context.goalSideY > bounds.sideY ? "south" : "north")
  return dirs
}
function addLabGoalDir(dirs, dir) {
  if (labDirections[dir] && !dirs.includes(dir)) dirs.push(dir)
}
function getLabExitTargetDirs(x, y, context) {
  const dirs = []
  if (!context) return dirs
  if (context.exitTargetX > x) addLabGoalDir(dirs, "east")
  else if (context.exitTargetX < x) addLabGoalDir(dirs, "west")
  if (context.exitTargetY > y) addLabGoalDir(dirs, "south")
  else if (context.exitTargetY < y) addLabGoalDir(dirs, "north")
  return dirs
}
function addLabWallAttachedGoalDirs(dirs, x, y, bounds, context) {
  if (!bounds || !context) return dirs
  if (bounds.sideX !== context.goalSideX) {
    const targetWallX = context.goalSideX > bounds.sideX ? bounds.maxX : bounds.minX
    if (x === targetWallX) {
      addLabGoalDir(dirs, "north")
      addLabGoalDir(dirs, "south")
    }
  } else {
    if (x === context.exitTargetX) {
      addLabGoalDir(dirs, "north")
      addLabGoalDir(dirs, "south")
    }
  }
  if (bounds.sideY !== context.goalSideY) {
    const targetWallY = context.goalSideY > bounds.sideY ? bounds.maxY : bounds.minY
    if (y === targetWallY) {
      addLabGoalDir(dirs, "east")
      addLabGoalDir(dirs, "west")
    }
  } else {
    if (y === context.exitTargetY) {
      addLabGoalDir(dirs, "east")
      addLabGoalDir(dirs, "west")
    }
  }
  return dirs
}
function computeLabImmediateGoalwardDirs(x, y, bounds, context) {
  if (bounds.sideX !== context.goalSideX || bounds.sideY !== context.goalSideY) {
    return addLabWallAttachedGoalDirs(getLabGoalwardDirsForQuadrant(bounds, context), x, y, bounds, context)
  }
  const dirs = getLabExitTargetDirs(x, y, context)
  if (isLabInExitSubquadrant(x, y, context)) return dirs
  return addLabWallAttachedGoalDirs(dirs, x, y, bounds, context)
}
function getLabImmediateGoalwardDirs(state, x, y, context = getLabInfluenceContext(state)) {
  if (!context) return []
  const bounds = getLabQuadrantBoundsForCoords(x, y, context)
  if (!bounds) return []
  if (state) {
    const signature = getLabInfluenceSignature(context)
    let cache = labGoalwardDirsCache.get(state)
    if (!cache || cache.signature !== signature) {
      cache = { signature, map: new Map() }
      labGoalwardDirsCache.set(state, cache)
    }
    const key = getLabKey(x, y)
    const cached = cache.map.get(key)
    if (cached) return cached
    const dirs = computeLabImmediateGoalwardDirs(x, y, bounds, context)
    cache.map.set(key, dirs)
    return dirs
  }
  return computeLabImmediateGoalwardDirs(x, y, bounds, context)
}

// ----- Visit stack ----------------------------------------------------------
// Per-worker history of forward steps.  Pop returns the dir that brought
// the worker to its current cell; its inverse is the only valid backstep.
function getLabWorkerVisitStack(workerId) {
  let stack = labWorkerVisitStack.get(workerId)
  if (!Array.isArray(stack)) {
    stack = []
    labWorkerVisitStack.set(workerId, stack)
  }
  return stack
}
function pushLabWorkerVisit(workerId, dir) {
  if (!workerId || typeof dir !== "string" || !dir) return
  getLabWorkerVisitStack(workerId).push(dir)
}
function popLabWorkerVisit(workerId) {
  if (!workerId) return ""
  const stack = getLabWorkerVisitStack(workerId)
  return stack.length > 0 ? stack.pop() : ""
}
function peekLabWorkerVisit(workerId) {
  if (!workerId) return ""
  const stack = labWorkerVisitStack.get(workerId)
  return Array.isArray(stack) && stack.length > 0 ? stack[stack.length - 1] : ""
}
function clearLabWorkerVisitStack(workerId) {
  if (workerId) labWorkerVisitStack.delete(workerId)
  if (workerId) labWorkerQuadrantCommit.delete(workerId)
}

// ----- State / room helpers -------------------------------------------------
function ensureLabDeadEndEntries(state) {
  if (!state || typeof state !== "object") return {}
  const priorEntries = state.deadEndEntries
  const legacyEscapeEntries = state.deadEndEscapeEntries
  const legacyEscape = state.deadEndEscape
  if (!priorEntries || typeof priorEntries !== "object" || Array.isArray(priorEntries)) {
    state.deadEndEntries = {}
  }
  const entries = state.deadEndEntries
  const absorbEntry = (key, escape) => {
    if (typeof key !== "string" || !key) return
    if (Object.prototype.hasOwnProperty.call(entries, key)) return
    entries[key] = typeof escape === "string" && labDirections[escape] ? escape : ""
  }
  if (Array.isArray(priorEntries)) {
    for (const entry of priorEntries) {
      if (Array.isArray(entry) && entry.length >= 2) absorbEntry(entry[0], entry[1])
    }
  }
  if (Array.isArray(legacyEscapeEntries)) {
    for (const entry of legacyEscapeEntries) {
      if (Array.isArray(entry) && entry.length >= 2) absorbEntry(entry[0], entry[1])
    }
  }
  if (legacyEscape instanceof Map) {
    for (const [key, escape] of legacyEscape.entries()) absorbEntry(key, escape)
  } else if (Array.isArray(legacyEscape)) {
    for (const entry of legacyEscape) {
      if (Array.isArray(entry) && entry.length >= 2) absorbEntry(entry[0], entry[1])
    }
  }
  if (Object.prototype.hasOwnProperty.call(state, "deadEndEscapeEntries")) delete state.deadEndEscapeEntries
  if (Object.prototype.hasOwnProperty.call(state, "deadEndEscape")) delete state.deadEndEscape
  return entries
}
function syncLabDeadEndSnapshot(state) {
  ensureLabDeadEndEntries(state)
}
function reviveLabDeadEndMap(state) {
  ensureLabDeadEndEntries(state)
  return state
}
function ensureLabQuadrantGatewaySection(state) {
  if (!state || typeof state !== "object") return {}
  if (!state.quadrantGateways || typeof state.quadrantGateways !== "object" || Array.isArray(state.quadrantGateways)) {
    state.quadrantGateways = {}
  }
  return state.quadrantGateways
}
function ensureLabDeadAreaQueue(state) {
  if (!state || typeof state !== "object") return []
  if (!Array.isArray(state.deadAreaQueue)) state.deadAreaQueue = []
  if (!state.deadAreaQueued || typeof state.deadAreaQueued !== "object" || Array.isArray(state.deadAreaQueued)) {
    state.deadAreaQueued = {}
    for (const key of state.deadAreaQueue) {
      if (typeof key === "string" && key) state.deadAreaQueued[key] = true
    }
  }
  return state.deadAreaQueue
}
function ensureLabDeadRouteCosts(state) {
  if (!state || typeof state !== "object") return {}
  if (!state.deadRouteCosts || typeof state.deadRouteCosts !== "object" || Array.isArray(state.deadRouteCosts)) state.deadRouteCosts = {}
  return state.deadRouteCosts
}
function ensureLabFrontierRouteCache(state) {
  if (!state || typeof state !== "object") return {}
  if (!state.frontierRouteCache || typeof state.frontierRouteCache !== "object" || Array.isArray(state.frontierRouteCache)) state.frontierRouteCache = {}
  return state.frontierRouteCache
}
function ensureLabDeadPrefilterChecks(state) {
  if (!state || typeof state !== "object") return {}
  if (!state.deadPrefilterChecks || typeof state.deadPrefilterChecks !== "object" || Array.isArray(state.deadPrefilterChecks)) state.deadPrefilterChecks = {}
  return state.deadPrefilterChecks
}
function ensureLabDeadKnowledgeChecks(state) {
  if (!state || typeof state !== "object") return {}
  if (!state.deadKnowledgeChecks || typeof state.deadKnowledgeChecks !== "object" || Array.isArray(state.deadKnowledgeChecks)) state.deadKnowledgeChecks = {}
  return state.deadKnowledgeChecks
}
function ensureLabDeadAreaEdgeCache(state) {
  if (!state || typeof state !== "object") return {}
  if (!state.deadAreaEdgeCache || typeof state.deadAreaEdgeCache !== "object" || Array.isArray(state.deadAreaEdgeCache)) state.deadAreaEdgeCache = {}
  return state.deadAreaEdgeCache
}
function ensureLabQuadrantTransitionCellCache(state) {
  if (!state || typeof state !== "object") return { signature: "", byTransition: {} }
  if (!state.quadrantTransitionCells || typeof state.quadrantTransitionCells !== "object" || Array.isArray(state.quadrantTransitionCells)) {
    state.quadrantTransitionCells = { signature: "", byTransition: {} }
  }
  if (!state.quadrantTransitionCells.byTransition || typeof state.quadrantTransitionCells.byTransition !== "object" || Array.isArray(state.quadrantTransitionCells.byTransition)) {
    state.quadrantTransitionCells.byTransition = {}
  }
  return state.quadrantTransitionCells
}
function setLabDeadRouteCost(state, x, y, cost) {
  if (!state || !Number.isInteger(x) || !Number.isInteger(y)) return
  ensureLabDeadRouteCosts(state)[getLabKey(x, y)] = Number.isFinite(cost) ? cost : Number.POSITIVE_INFINITY
}
function getLabDeadRouteCost(state, x, y) {
  if (!state || !Number.isInteger(x) || !Number.isInteger(y)) return Number.POSITIVE_INFINITY
  const value = ensureLabDeadRouteCosts(state)[getLabKey(x, y)]
  if (Number.isFinite(value)) return value
  if (value && typeof value === "object" && Number.isFinite(value.cost)) return value.cost
  return Number.POSITIVE_INFINITY
}
function hasLabDeadRouteCost(state, x, y) {
  if (!state || !Number.isInteger(x) || !Number.isInteger(y)) return false
  const value = ensureLabDeadRouteCosts(state)[getLabKey(x, y)]
  return Number.isFinite(value) || value === Number.POSITIVE_INFINITY
    || Boolean(value && typeof value === "object" && (Number.isFinite(value.cost) || value.cost === Number.POSITIVE_INFINITY))
}
function enqueueLabDeadAreaSource(state, x, y) {
  if (!state?.rooms || !Number.isInteger(x) || !Number.isInteger(y)) return false
  const key = getLabKey(x, y)
  const room = state.rooms[key]
  if (!room?.explored || !room.exits) return false
  const queue = ensureLabDeadAreaQueue(state)
  if (state.deadAreaQueued?.[key] === true) return false
  state.deadAreaQueued[key] = true
  queue.push(key)
  return true
}
function enqueueLabDeadAreaAround(state, x, y, context = getLabInfluenceContext(state)) {
  if (!state?.rooms || !Number.isInteger(x) || !Number.isInteger(y)) return false
  let changed = enqueueLabDeadAreaSource(state, x, y)
  for (const [, delta] of labDirectionEntries) {
    const nx = x + delta.dx
    const ny = y + delta.dy
    if (context && !isLabSameQuadrantMove(state, x, y, nx, ny, context)) continue
    if (enqueueLabDeadAreaSource(state, nx, ny)) changed = true
  }
  return changed
}
function reviveLabQuadrantGateways(state) {
  ensureLabQuadrantGatewaySection(state)
  return state
}
function syncLabSharedSections(state) {
  syncLabDeadEndSnapshot(state)
  reviveLabQuadrantGateways(state)
  ensureLabDeadAreaQueue(state)
  ensureLabDeadRouteCosts(state)
  ensureLabFrontierRouteCache(state)
  ensureLabDeadPrefilterChecks(state)
  ensureLabDeadKnowledgeChecks(state)
  ensureLabDeadAreaEdgeCache(state)
  ensureLabQuadrantTransitionCellCache(state)
  return state
}
function reviveLabState(state, server) {
  if (!state || typeof state !== "object" || !state.rooms) return null
  state.serverName = state.serverName || server
  if (!state.workers || typeof state.workers !== "object") state.workers = {}
  if (!Array.isArray(state.displayMap)) state.displayMap = []
  if (!Array.isArray(state.displayDirtyCells)) state.displayDirtyCells = []
  if (!state.displayDirtyLookup || typeof state.displayDirtyLookup !== "object" || Array.isArray(state.displayDirtyLookup)) state.displayDirtyLookup = {}
  if (!Array.isArray(state.startKeys)) state.startKeys = []
  state.workersVersion = state.workersVersion ?? 0
  state.displayVersion = state.displayVersion ?? 0
  state.displayLayoutKey = state.displayLayoutKey ?? ""
  state.displayOutputKey = state.displayOutputKey ?? ""
  state.displayOutputLayoutKey = state.displayOutputLayoutKey ?? ""
  normalizeLabStartKeys(state)
  syncLabSharedSections(state)
  return state
}
function ensureLabState(server) {
  if (labState && labState.serverName === server) return labState
  const existing = typeof inProgress?.get === "function" ? reviveLabState(inProgress.get(server), server) : null
  if (existing) {
    labState = existing
    labComplete = false
    labWorkerVisitStack = new Map()
    labWorkerQuadrantCommit = new Map()
    if (typeof inProgress?.set === "function") inProgress.set(server, labState)
    return labState
  }
  // New server (or first call): blow away module state for this run.
  labState = {
    serverName: server,
    rooms: {},
    layout: null,
    workers: {},
    workersVersion: 0,
    displayMap: [],
    displayDirtyCells: [],
    displayDirtyLookup: {},
    displayLayoutKey: "",
    displayVersion: 0,
    displayOutputKey: "",
    displayOutputLayoutKey: "",
    displayOutputRows: null,
    rootKey: "",
    finishKey: "",
    coordOffsetX: 0,
    coordOffsetY: 0,
    startKeys: [],
    deadEndEntries: {},
    deadRouteCosts: {},
    frontierRouteCache: {},
    deadPrefilterChecks: {},
    deadKnowledgeChecks: {},
    deadAreaEdgeCache: {},
    deadAreaQueue: [],
    deadAreaQueued: {},
    quadrantGateways: {},
    quadrantTransitionCells: { signature: "", byTransition: {} }
  }
  labComplete = false
  labWorkerVisitStack = new Map()
  labWorkerQuadrantCommit = new Map()
  return labState
}
function ensureLabRoom(state, x, y, path = []) {
  const key = getLabKey(x, y)
  if (!state.rooms[key]) {
    state.rooms[key] = {
      x, y,
      path: path.slice(),
      jsonLog: null,
      exits: null,
      explored: false
    }
  } else if (path.length > 0 && state.rootKey !== key
    && (state.rooms[key].path.length === 0 || path.length < state.rooms[key].path.length)) {
    state.rooms[key].path = path.slice()
  }
  return state.rooms[key]
}
function ensureLabDisplayDirtyCells(state) {
  if (!state || typeof state !== "object") return []
  if (!Array.isArray(state.displayDirtyCells)) state.displayDirtyCells = []
  if (!state.displayDirtyLookup || typeof state.displayDirtyLookup !== "object" || Array.isArray(state.displayDirtyLookup)) state.displayDirtyLookup = {}
  return state.displayDirtyCells
}
function markLabDisplayDirtyCell(state, boardX, boardY) {
  if (!state || !Number.isInteger(boardX) || !Number.isInteger(boardY)) return false
  const key = `${boardX},${boardY}`
  ensureLabDisplayDirtyCells(state)
  if (state.displayDirtyLookup[key] === true) return false
  state.displayDirtyLookup[key] = true
  state.displayDirtyCells.push([boardX, boardY])
  return true
}
function markLabDisplayDirtyCoords(state, x, y) {
  const info = getLabBoardInfo(state?.layout)
  if (!info) return false
  return markLabDisplayDirtyCell(state, x - info.originX, y - info.originY)
}
function consumeLabDisplayDirtyCells(state) {
  if (!state) return []
  const cells = Array.isArray(state.displayDirtyCells) ? state.displayDirtyCells : []
  state.displayDirtyCells = []
  state.displayDirtyLookup = {}
  return cells
}
function markAllLabDisplayCellsDirty(state) {
  const displayMap = state?.displayMap
  if (!Array.isArray(displayMap)) return
  for (let y = 0; y < displayMap.length; y++) {
    const row = typeof displayMap[y] === "string" ? displayMap[y] : ""
    for (let x = 0; x < row.length; x++) markLabDisplayDirtyCell(state, x, y)
  }
}
function addLabStartMarker(state, x, y) {
  if (!state || !Number.isInteger(x) || !Number.isInteger(y)) return
  if (!Array.isArray(state.startKeys)) state.startKeys = []
  const key = getLabKey(x, y)
  normalizeLabStartKeys(state)
  if (state.startKeys.includes(key)) return
  state.startKeys.push(key)
  const room = state.rooms?.[key]
  markLabDisplayDirtyCoords(state, room?.x ?? x, room?.y ?? y)
  state.displayOutputKey = ""
}
function normalizeLabStartKeys(state) {
  if (!state || typeof state !== "object") return []
  if (!Array.isArray(state.startKeys)) state.startKeys = []
  const nextKeys = []
  for (const key of state.startKeys) {
    if (typeof key !== "string" || !state.rooms?.[key] || nextKeys.includes(key)) continue
    nextKeys.push(key)
  }
  if (nextKeys.length === 0 && typeof state.rootKey === "string" && state.rootKey && state.rooms?.[state.rootKey]) {
    nextKeys.push(state.rootKey)
  }
  if (nextKeys.length !== state.startKeys.length || nextKeys.some((key, index) => key !== state.startKeys[index])) {
    state.startKeys = nextKeys
    state.displayOutputKey = ""
  }
  return state.startKeys
}
function getLabStartCoords(state) {
  return normalizeLabStartKeys(state)
    .map((key) => state.rooms?.[key]).filter(Boolean)
    .map((room) => [room.x, room.y])
}
function setLabWorkerPosition(state, workerId, x, y) {
  if (!state.workers) state.workers = {}
  const existing = state.workers[workerId]
  if (existing && existing.x === x && existing.y === y) return
  if (existing) markLabDisplayDirtyCoords(state, existing.x, existing.y)
  state.workers[workerId] = { x, y }
  markLabDisplayDirtyCoords(state, x, y)
  state.workersVersion = (state.workersVersion ?? 0) + 1
}

function recordLabRoom(a, b, c, d, e, f, g) {
  let state, x, y, report, path, allowOverwrite
  if (typeof a === "string") {
    // OLD: server, details, x, y, report, path, allowOverwrite
    state = getLabState(a, b)
    x = c; y = d; report = e
    path = Array.isArray(f) ? f : []
    allowOverwrite = g === true
  } else {
    // NEW: state, x, y, report, path, allowOverwrite
    state = a
    x = b; y = c; report = d
    path = Array.isArray(e) ? e : []
    allowOverwrite = f === true
  }
  if (!state || typeof state !== "object" || !state.rooms) return

  if (!state.rootKey
    && path.length === 0
    && Array.isArray(report?.coords)
    && Number.isInteger(report.coords[0])
    && Number.isInteger(report.coords[1])) {
    state.coordOffsetX = 0
    state.coordOffsetY = 0
  }
  const [actualX, actualY] = getLabActualCoords(x, y, report, state)
  if (path.length === 0 && !state.rootKey) state.rootKey = getLabKey(actualX, actualY)
  const room = ensureLabRoom(state, actualX, actualY, path)
  if (path.length === 0 || state.rootKey === getLabKey(actualX, actualY)) room.path = []
  const nextExits = sanitizeLabRoomExits(state, actualX, actualY, {
    north: report?.north === true,
    east: report?.east === true,
    south: report?.south === true,
    west: report?.west === true
  })
  const wasExplored = room.explored === true
  const exitsConflict = wasExplored
    && room.exits
    && labDirectionEntries.some(([dir]) => room.exits[dir] !== nextExits[dir])
  if (exitsConflict && !allowOverwrite) return
  const roomKey = getLabKey(actualX, actualY)
  const pathImproved = state.rootKey !== roomKey
    && path.length > 0
    && (room.path.length === 0 || path.length < room.path.length)
  if (wasExplored && !exitsConflict && !pathImproved) {
    room.jsonLog = report
    return
  }
  room.jsonLog = report
  room.exits = nextExits
  room.explored = true
  if (path.length === 0 || state.rootKey === roomKey) room.path = []
  else if (pathImproved) room.path = path.slice()
  recordLabQuadrantGatewaysFromExits(state, actualX, actualY, room.exits)

  for (const [dir, delta] of labDirectionEntries) {
    const nextX = actualX + delta.dx
    const nextY = actualY + delta.dy
    const nextKey = getLabKey(nextX, nextY)
    if (!room.exits[dir]) {
      const stale = state.rooms[nextKey]
      const blockedPath = path.concat(dir)
      if (stale && !stale.explored && Array.isArray(stale.path)
        && stale.path.length === blockedPath.length
        && stale.path.every((step, index) => step === blockedPath[index])) {
        delete state.rooms[nextKey]
      }
      continue
    }
    if (state.layout && (nextX < state.layout.minX || nextX > state.layout.maxX
      || nextY < state.layout.minY || nextY > state.layout.maxY)) continue
    ensureLabRoom(state, nextX, nextY, path.concat(dir))
  }

  syncLabDisplayMap(state)
  updateLabDisplayFromRoom(state, room)
  // Predictive dead-end marking for unexplored neighbours.  When the new
  // wall info on this room leaves a frontier without a potential route
  // to a goalward quadrant border or exit area, mark that neighbour dead
  // before any worker tries to step into it.
  updateLabDeadKnowledgeFromRoom(state, actualX, actualY)
}


// ----- Display map ----------------------------------------------------------
function getLabBoardInfo(layout) {
  if (!layout) return null
  const { minX, minY, maxX, maxY, goalX, goalY } = layout
  return {
    minX, minY, maxX, maxY, goalX, goalY,
    originX: minX - 1,
    originY: minY - 1,
    width: maxX - minX + 3,
    height: maxY - minY + 3
  }
}
function setLabDisplayChar(state, boardX, boardY, char) {
  const displayMap = state?.displayMap
  if (!Array.isArray(displayMap) || !Number.isInteger(boardX) || !Number.isInteger(boardY)) return false
  if (boardY < 0 || boardY >= displayMap.length) return false
  const row = displayMap[boardY]
  if (typeof row !== "string" || boardX < 0 || boardX >= row.length) return false
  if (row[boardX] === char) return false
  displayMap[boardY] = row.slice(0, boardX) + char + row.slice(boardX + 1)
  markLabDisplayDirtyCell(state, boardX, boardY)
  return true
}
function setLabDisplayCharAtCoords(state, x, y, char) {
  const info = getLabBoardInfo(state?.layout)
  if (!info) return false
  return setLabDisplayChar(state, x - info.originX, y - info.originY, char)
}
function createLabDisplayMap(layout) {
  const info = getLabBoardInfo(layout)
  if (!info) return []
  return Array.from({ length: info.height }, (_, rowIndex) => {
    let row = ""
    for (let colIndex = 0; colIndex < info.width; colIndex++) {
      const x = info.originX + colIndex
      const y = info.originY + rowIndex
      const inBounds = x >= info.minX && x <= info.maxX && y >= info.minY && y <= info.maxY
      if (!inBounds || (x % 2 === 0 && y % 2 === 0)) row += labMapFill
      else if (x % 2 === 1 && y % 2 === 1) row += labMapUnknownRoom
      else row += labMapPossibleHall
    }
    return row
  })
}
function updateLabDisplayFromRoom(state, room) {
  const info = getLabBoardInfo(state?.layout)
  if (!info || !room || !Array.isArray(state.displayMap)) return
  if (room.x < info.minX || room.x > info.maxX || room.y < info.minY || room.y > info.maxY) return
  let changed = setLabDisplayChar(state, room.x - info.originX, room.y - info.originY,
    room.explored ? labMapOpen : labMapUnknownRoom)
  for (const [dir, delta] of labDirectionEntries) {
    const exitState = room.exits?.[dir]
    if (exitState !== true && exitState !== false) continue
    changed = setLabDisplayCharAtCoords(state, room.x + delta.dx / 2, room.y + delta.dy / 2,
      exitState ? labMapOpen : labMapFill) || changed
  }
  if (changed) {
    state.displayVersion = (state.displayVersion ?? 0) + 1
    state.displayOutputKey = ""
  }
}
function syncLabDisplayMap(state, forceRebuild = false) {
  if (!state?.layout) {
    state.displayLayoutKey = ""
    if (!Array.isArray(state.displayMap)) state.displayMap = []
    return state.displayMap
  }
  const layoutKey = getLabDisplayLayoutKey(state.layout)
  if (forceRebuild || !Array.isArray(state.displayMap) || state.displayLayoutKey !== layoutKey) {
    state.displayMap = createLabDisplayMap(state.layout)
    state.displayDirtyCells = []
    state.displayDirtyLookup = {}
    markAllLabDisplayCellsDirty(state)
    state.displayLayoutKey = layoutKey
    for (const room of Object.values(state.rooms)) updateLabDisplayFromRoom(state, room)
    for (const transitionKey of Object.keys(ensureLabQuadrantGatewaySection(state))) {
      applyLabQuadrantGatewayWalls(state, transitionKey)
    }
    state.displayVersion = (state.displayVersion ?? 0) + 1
    state.displayOutputKey = ""
  }
  return state.displayMap
}
function buildLabMapOutput(boardRows, layout, workers = {}, anchors = {}) {
  const info = getLabBoardInfo(layout)
  if (!info) return Array.isArray(boardRows) ? boardRows.slice() : []
  const rows = Array.isArray(boardRows) ? boardRows.slice() : []
  const dirtyCells = Array.isArray(anchors.dirtyCells) ? anchors.dirtyCells : []
  const dirtyLookup = {}
  for (const cell of dirtyCells) {
    if (!Array.isArray(cell) || cell.length < 2) continue
    dirtyLookup[`${cell[0]},${cell[1]}`] = true
  }
  const markDirty = (boardX, boardY) => {
    if (!Number.isInteger(boardX) || !Number.isInteger(boardY)) return
    const key = `${boardX},${boardY}`
    if (dirtyLookup[key] === true) return
    dirtyLookup[key] = true
    dirtyCells.push([boardX, boardY])
  }
  const setCell = (x, y, value) => {
    const boardX = x - info.originX
    const boardY = y - info.originY
    if (boardY < 0 || boardY >= rows.length) return
    const row = rows[boardY]
    if (typeof row !== "string" || boardX < 0 || boardX >= row.length) return
    if (row[boardX] === value) return
    rows[boardY] = row.slice(0, boardX) + value + row.slice(boardX + 1)
    markDirty(boardX, boardY)
  }
  for (const worker of Object.values(workers ?? {})) {
    if (!worker || !Number.isInteger(worker.x) || !Number.isInteger(worker.y)) continue
    setCell(worker.x, worker.y, labMapWorker)
  }
  const startCoords = Array.isArray(anchors.startCoords) ? anchors.startCoords : []
  const finishX = Number.isInteger(anchors.finishX) ? anchors.finishX : layout?.finishX
  const finishY = Number.isInteger(anchors.finishY) ? anchors.finishY : layout?.finishY
  if (Number.isInteger(finishX) && Number.isInteger(finishY)) setCell(finishX, finishY, labMapFinish)
  for (const [startX, startY] of startCoords) {
    if (Number.isInteger(startX) && Number.isInteger(startY)) setCell(startX, startY, labMapStart)
  }
  return rows
}
function getLabBoardRowChar(rows, boardX, boardY) {
  const row = Array.isArray(rows) && typeof rows[boardY] === "string" ? rows[boardY] : ""
  return boardX >= 0 && boardX < row.length ? row[boardX] : labMapFill
}
function patchLabMapOutputRows(previousRows, boardRows, layout, workers = {}, anchors = {}) {
  const info = getLabBoardInfo(layout)
  if (!info || !Array.isArray(previousRows)) return buildLabMapOutput(boardRows, layout, workers, anchors)
  const rows = previousRows.slice()
  const dirtyCells = Array.isArray(anchors.dirtyCells) ? anchors.dirtyCells : []
  const workerCells = {}
  for (const worker of Object.values(workers ?? {})) {
    if (!worker || !Number.isInteger(worker.x) || !Number.isInteger(worker.y)) continue
    workerCells[`${worker.x - info.originX},${worker.y - info.originY}`] = true
  }
  const startCells = {}
  const startCoords = Array.isArray(anchors.startCoords) ? anchors.startCoords : []
  for (const [startX, startY] of startCoords) {
    if (Number.isInteger(startX) && Number.isInteger(startY)) startCells[`${startX - info.originX},${startY - info.originY}`] = true
  }
  const finishX = Number.isInteger(anchors.finishX) ? anchors.finishX : layout?.finishX
  const finishY = Number.isInteger(anchors.finishY) ? anchors.finishY : layout?.finishY
  const finishBoardX = Number.isInteger(finishX) ? finishX - info.originX : null
  const finishBoardY = Number.isInteger(finishY) ? finishY - info.originY : null
  const setCell = (boardX, boardY) => {
    if (!Number.isInteger(boardX) || !Number.isInteger(boardY) || boardY < 0 || boardY >= rows.length) return
    const row = typeof rows[boardY] === "string" ? rows[boardY] : ""
    if (boardX < 0 || boardX >= row.length) return
    const key = `${boardX},${boardY}`
    let value = getLabBoardRowChar(boardRows, boardX, boardY)
    if (workerCells[key] === true) value = labMapWorker
    if (finishBoardX === boardX && finishBoardY === boardY) value = labMapFinish
    if (startCells[key] === true) value = labMapStart
    if (row[boardX] === value) return
    rows[boardY] = row.slice(0, boardX) + value + row.slice(boardX + 1)
  }
  for (const cell of dirtyCells) {
    if (!Array.isArray(cell) || cell.length < 2) continue
    setCell(cell[0], cell[1])
  }
  return rows
}
function buildLabMapObject(state, forceRebuild = false) {
  if (!state?.layout) return []
  const startCoords = getLabStartCoords(state)
  if (startCoords.length === 0 && state.rootKey && state.rooms[state.rootKey]) {
    startCoords.push([state.rooms[state.rootKey].x, state.rooms[state.rootKey].y])
  }
  const board = syncLabDisplayMap(state, forceRebuild)
  const anchorKey = `${startCoords.map((p) => p.join(",")).join(";")}|${state.layout.finishX},${state.layout.finishY}`
  const outputKey = `${state.displayLayoutKey}|${state.displayVersion ?? 0}|${state.workersVersion ?? 0}|${anchorKey}`
  const hasPendingDirtyCells = Array.isArray(state.displayDirtyCells) && state.displayDirtyCells.length > 0
  if (!forceRebuild && !hasPendingDirtyCells && state.displayOutputKey === outputKey && Array.isArray(state.displayOutputRows)) {
    return state.displayOutputRows
  }
  const dirtyCells = consumeLabDisplayDirtyCells(state)
  const anchors = {
    startCoords,
    finishX: state.layout.finishX,
    finishY: state.layout.finishY,
    dirtyCells
  }
  const canPatch = !forceRebuild
    && Array.isArray(state.displayOutputRows)
    && state.displayOutputLayoutKey === state.displayLayoutKey
    && dirtyCells.length > 0
  const rows = canPatch
    ? patchLabMapOutputRows(state.displayOutputRows, board, state.layout, state.workers, anchors)
    : buildLabMapOutput(board, state.layout, state.workers, anchors)
  state.displayOutputKey = outputKey
  state.displayOutputLayoutKey = state.displayLayoutKey
  state.displayOutputRows = rows
  state.displayOutputDirtyCells = dirtyCells
  return rows
}
function buildLabMapSnapshotRows(state) {
  if (!state?.layout || !Array.isArray(state.displayMap)) return []
  const startCoords = getLabStartCoords(state)
  if (startCoords.length === 0 && state.rootKey && state.rooms[state.rootKey]) {
    startCoords.push([state.rooms[state.rootKey].x, state.rooms[state.rootKey].y])
  }
  return buildLabMapOutput(state.displayMap, state.layout, state.workers, {
    startCoords,
    finishX: state.layout.finishX,
    finishY: state.layout.finishY,
    dirtyCells: []
  })
}
function getLabMapSourceKey(state) {
  if (!state?.layout) return ""
  const startKey = normalizeLabStartKeys(state).join(";")
  return `${state.displayLayoutKey}|${state.displayVersion ?? 0}|${state.workersVersion ?? 0}|${state.rootKey ?? ""}|${startKey}|${state.layout.finishX},${state.layout.finishY}`
}
function getLabMapDimensions(map = []) {
  if (!Array.isArray(map)) return { cols: 0, rows: 0 }
  let cols = 0
  for (const line of map) if (typeof line === "string" && line.length > cols) cols = line.length
  return { cols, rows: map.length }
}

// ----- Worker process -------------------------------------------------------
async function labWork(ns, labWorker, dir) {
  if (!labWorker) return { finished: false, workerExited: true, authResults: false }
  //ns.clearPort(ns.pid)
  ns.writePort(labWorker, dir.toString())
  return await readQueuedPort(ns, ns.pid)
}
async function startLabWorker(ns, server) {
  const host = ns.self().server
  const scriptRam = 2
  const freeRam = await proxyHome(ns, "getServerMaxRam", host) - await proxyHome(ns, "getServerUsedRam", host)
  const threads = Math.floor(freeRam / scriptRam)
  if (threads < 1) return 0
  return ns.exec(labWorkerScriptPath, host, { threads, temporary: true }, server, ns.pid)
}
// labHunter — written to disk once per run and ns.exec'd.  Listens on its
// own pid for a direction, calls ns.dnet.authenticate (or labreport for the
// bootstrap probe), writes the result to the outer process's pid port,
// exits only when authenticate returns a solved result instead of another
// labyrinth room report.
function writeLabHunter(ns) {
  const data = `/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  let finalMessage = { finished: false, workerExited: true, authResults: false }
  const sanitizeAuthResult = (result, includeData = false) => ({
    success: Boolean(result?.success),
    code: result?.code ?? null,
    message: typeof result?.message === "string" ? result.message : "",
    data: includeData ? (typeof result?.data === "string" ? result.data : result?.data ?? null) : null
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
  const getRawCoordsFromAuthResult = (result) => {
    const message = typeof result?.message === "string" ? result.message : ""
    let idx = message.indexOf("You have moved to")
    if (idx >= 0) idx += 17
    else {
      idx = message.indexOf("You are still at")
      if (idx >= 0) idx += 16
    }
    if (idx < 0) return null
    const parseNumber = () => {
      while (idx < message.length && message.charCodeAt(idx) <= 32) idx++
      let sign = 1
      if (message[idx] === "-") { sign = -1; idx++ }
      let value = 0
      let sawDigit = false
      while (idx < message.length) {
        const code = message.charCodeAt(idx)
        if (code < 48 || code > 57) break
        value = value * 10 + code - 48
        sawDigit = true
        idx++
      }
      return sawDigit ? value * sign : null
    }
    const rawX = parseNumber()
    while (idx < message.length && (message.charCodeAt(idx) <= 32 || message[idx] === ",")) idx++
    const rawY = parseNumber()
    return Number.isInteger(rawX) && Number.isInteger(rawY) ? [rawX, rawY] : null
  }
  const parseAuthDataExits = (data) => {
    if (typeof data !== "string") return null
    const at = data.indexOf("@")
    if (at < 0) return null
    const fillChar = ${JSON.stringify(labMapFill)}
    const rowStart = data.lastIndexOf("\\n", at - 1) + 1
    let rowEnd = data.indexOf("\\n", at)
    if (rowEnd < 0) rowEnd = data.length
    if (rowEnd > rowStart && data.charCodeAt(rowEnd - 1) === 13) rowEnd--
    const atX = at - rowStart
    const isOpenAt = (idx, start, end) => idx >= start && idx < end && data[idx] !== fillChar && data.charCodeAt(idx) !== 10 && data.charCodeAt(idx) !== 13
    const rowAt = (start, x) => {
      if (start < 0) return null
      let end = data.indexOf("\\n", start)
      if (end < 0) end = data.length
      if (end > start && data.charCodeAt(end - 1) === 13) end--
      return { start, end, idx: start + x }
    }
    const prevBreak = rowStart > 0 ? data.lastIndexOf("\\n", rowStart - 2) : -1
    let prevEnd = rowStart > 0 ? rowStart - 1 : -1
    if (prevEnd > 0 && data.charCodeAt(prevEnd - 1) === 13) prevEnd--
    const prevStart = rowStart > 0 ? prevBreak + 1 : -1
    const nextBreak = data.indexOf("\\n", rowEnd)
    const next = nextBreak >= 0 ? rowAt(nextBreak + 1, atX) : null
    return {
      north: isOpenAt(prevStart + atX, prevStart, prevEnd),
      east: isOpenAt(at + 1, rowStart, rowEnd),
      south: next ? isOpenAt(next.idx, next.start, next.end) : false,
      west: isOpenAt(at - 1, rowStart, rowEnd)
    }
  }
  const getAuthLabReport = (result) => {
    const coords = getRawCoordsFromAuthResult(result)
    const exits = parseAuthDataExits(result?.data)
    if (!Array.isArray(coords) || !exits) return false
    return {
      success: true,
      coords,
      north: exits.north === true,
      east: exits.east === true,
      south: exits.south === true,
      west: exits.west === true
    }
  }
  const currentRoomCommand = ${JSON.stringify(labCurrentRoomCommand)}
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
    const movementReport = getAuthLabReport(results)
    const response = {
      finished: Boolean(results?.success) && !movementReport,
      report: movementReport,
      authResults: sanitizeAuthResult(results, Boolean(results?.success) && !movementReport),
      dir
    }
    if (response.finished) {
      finalMessage = response
      ns.writePort(ns.args[1], response)
      ns.exit()
    } else {
      ns.writePort(ns.args[1], response)
    }
  }
}`
  ns.write(labWorkerScriptPath, data, "w")
}

// ----- Picker — pickGreedyStep ----------------------------------------------
// Priority chain:
//   1. Unexplored goalward
//   2. Unexplored forward (off-axis)
//   3. Bounded route through explored rooms to the nearest viable frontier.
//   4. Backstep from exhausted rooms.
//
// Once inside the exit quadrant, same-quadrant and exit-subquadrant
// routes outrank shorter paths that leave through an old boundary.
//
// Back direction is the inverse of the visit-stack top.  It is still
// checked against dead-room markers unless it is crossing quadrants or
// following a recorded dead-area escape.
// ============================================================================
// Dead-end tracking.
//
// A "dead end" is a room from which only one open exit still leads to a
// non-dead cell — that one direction is the room's escape.  Leaves
// (1-exit rooms) are dead with escape = the entry exit.  Corridors whose
// far end is dead become dead with escape = the surviving direction.
// Propagation is incremental: when a room is newly marked dead, every
// open neighbour is re-evaluated, which can trigger further marking up
// the chain.
//
// Stored on labState.deadEndEntries as one append-only section:
//   { [roomKey]: escapeDir }
// Every worker reads this same object; a worker that walks into an
// already-marked dead-end cell uses the escape immediately rather than
// re-deriving anything.
// Sealed cells (zero live exits) get escape = "" — the picker treats
// these as terminal.
// ============================================================================
function appendLabDeadEndEntry(state, key, escape = "") {
  if (!state || typeof key !== "string" || !key) return false
  const coords = getLabCoordsFromKey(key)
  if (coords && isLabProtectedDeadAreaCell(state, coords[0], coords[1])) return false
  const entries = ensureLabDeadEndEntries(state)
  if (Object.prototype.hasOwnProperty.call(entries, key)) return false
  entries[key] = typeof escape === "string" && labDirections[escape] ? escape : ""
  if (coords) {
    setLabDeadRouteCost(state, coords[0], coords[1], Number.POSITIVE_INFINITY)
    enqueueLabDeadAreaAround(state, coords[0], coords[1])
  }
  return true
}
function isLabDeadEndRoom(state, x, y) {
  if (!state) return false
  if (isLabProtectedDeadAreaCell(state, x, y)) return false
  const entries = ensureLabDeadEndEntries(state)
  return Object.prototype.hasOwnProperty.call(entries, getLabKey(x, y))
}
function getLabDeadEndEscape(state, x, y) {
  if (!state) return null
  if (isLabProtectedDeadAreaCell(state, x, y)) return null
  const entries = ensureLabDeadEndEntries(state)
  const key = getLabKey(x, y)
  return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null
}
function canLabDeadEscapeReachOpen(state, currentX, currentY, dir, context = getLabInfluenceContext(state)) {
  const delta = labDirections[dir]
  const layout = state?.layout
  if (!delta || !layout) return false
  const seen = new Set([getLabKey(currentX, currentY)])
  let x = currentX + delta.dx
  let y = currentY + delta.dy
  const roomCols = Math.floor((layout.maxX - layout.minX) / 2) + 1
  const roomRows = Math.floor((layout.maxY - layout.minY) / 2) + 1
  const maxSteps = Math.max(16, roomCols * roomRows)
  for (let step = 0; step < maxSteps; step++) {
    if (x < layout.minX || x > layout.maxX || y < layout.minY || y > layout.maxY) return false
    if (!isLabSameQuadrantCell(state, currentX, currentY, x, y, context)) return false
    const key = getLabKey(x, y)
    if (seen.has(key)) return false
    if (!isLabDeadEndRoom(state, x, y)) return true
    seen.add(key)
    const escape = getLabDeadEndEscape(state, x, y)
    const escapeDelta = labDirections[escape]
    if (!escapeDelta) return false
    x += escapeDelta.dx
    y += escapeDelta.dy
  }
  return false
}
function createLabMoveGate(state, options = {}) {
  const context = options?.context ?? getLabInfluenceContext(state)
  const skipKeys = getLabPickSkipSet(options)
  const workerId = typeof options?.workerId === "string" ? options.workerId : ""
  const currentX = Number.isInteger(options?.currentX) ? options.currentX : null
  const currentY = Number.isInteger(options?.currentY) ? options.currentY : null
  const committedQuadrant = workerId && Number.isInteger(currentX) && Number.isInteger(currentY)
    ? getLabWorkerCommittedQuadrant(state, workerId, currentX, currentY, context)
    : (workerId ? labWorkerQuadrantCommit.get(workerId) ?? "" : "")
  const cacheScope = workerId ? `${workerId}:${committedQuadrant}` : ""
  const moveCache = new Map()
  const deadRoomCache = new Map()
  const escapeCache = new Map()
  const checkDeadRoom = (x, y) => {
    const key = getLabKey(x, y)
    if (!deadRoomCache.has(key)) deadRoomCache.set(key, isLabDeadEndRoom(state, x, y))
    return deadRoomCache.get(key)
  }
  const getEscape = (x, y) => {
    const key = getLabKey(x, y)
    if (!escapeCache.has(key)) escapeCache.set(key, getLabDeadEndEscape(state, x, y))
    return escapeCache.get(key)
  }
  const check = (currentX, currentY, dir, checkOptions = {}) => {
    const cacheKey = `${getLabKey(currentX, currentY)}:${dir}:${checkOptions.ignoreSkip === true ? 1 : 0}`
    if (moveCache.has(cacheKey)) return moveCache.get(cacheKey)
    const delta = labDirections[dir]
    if (!state || !delta || !Number.isInteger(currentX) || !Number.isInteger(currentY)) {
      const result = { allowed: false, reason: "invalid" }
      moveCache.set(cacheKey, result)
      return result
    }
    const nextX = currentX + delta.dx
    const nextY = currentY + delta.dy
    const crossing = getLabQuadrantTransitionForDir(state, currentX, currentY, dir, context)
    if (crossing) {
      const currentRoom = state.rooms?.[getLabKey(currentX, currentY)]
      if (currentRoom?.explored === true && currentRoom.exits?.[dir] !== true) {
        const result = { allowed: false, reason: "wall", x: nextX, y: nextY, crossing, gateway: false }
        moveCache.set(cacheKey, result)
        return result
      }
      const nextRoom = state.rooms?.[getLabKey(nextX, nextY)]
      const back = labDirections[dir].back
      if (nextRoom?.explored === true && nextRoom.exits?.[back] === false) {
        const result = { allowed: false, reason: "back-wall", x: nextX, y: nextY, crossing, gateway: false }
        moveCache.set(cacheKey, result)
        return result
      }
      const workerBlockReason = getLabWorkerQuadrantBlockReason(state, workerId, currentX, currentY, nextX, nextY, context)
      if (workerBlockReason) {
        const result = { allowed: false, reason: workerBlockReason, x: nextX, y: nextY, crossing, gateway: false }
        moveCache.set(cacheKey, result)
        return result
      }
      const gateway = ensureLabQuadrantGatewaySection(state)[crossing.transitionKey]
      if (!isLabLiveQuadrantCrossing(state, currentX, currentY, dir, context)) {
        const reason = gateway?.edgeKey && gateway.edgeKey !== crossing.edgeKey ? "quadrant-wall" : "worse-quadrant"
        const result = { allowed: false, reason, x: nextX, y: nextY, crossing, gateway: false }
        moveCache.set(cacheKey, result)
        return result
      }
      const result = {
        allowed: true,
        reason: "quadrant-gateway",
        x: nextX,
        y: nextY,
        crossing,
        gateway: Boolean(gateway?.edgeKey && gateway.edgeKey === crossing.edgeKey)
      }
      moveCache.set(cacheKey, result)
      return result
    }
    if (checkOptions.ignoreSkip !== true && isLabPickSkipped(skipKeys, nextX, nextY)) {
      const result = { allowed: false, reason: "skipped", x: nextX, y: nextY }
      moveCache.set(cacheKey, result)
      return result
    }
    if (!checkDeadRoom(nextX, nextY)) {
      const result = { allowed: true, reason: "open", x: nextX, y: nextY }
      moveCache.set(cacheKey, result)
      return result
    }
    const escape = getEscape(currentX, currentY)
    if (escape && escape === dir && canLabDeadEscapeReachOpen(state, currentX, currentY, dir, context)) {
      const result = { allowed: true, reason: "dead-escape", x: nextX, y: nextY }
      moveCache.set(cacheKey, result)
      return result
    }
    const result = { allowed: false, reason: "dead", x: nextX, y: nextY }
    moveCache.set(cacheKey, result)
    return result
  }
  return { context, cacheScope, check, isDeadRoom: checkDeadRoom, getEscape }
}
function isLabDeadMoveBlocked(state, currentX, currentY, dir, context = getLabInfluenceContext(state)) {
  return !createLabMoveGate(state, { context }).check(currentX, currentY, dir).allowed
}
function canLabDeadNeighbourCarryEscape(state, dirFromCurrent, neighbourX, neighbourY) {
  const neighbourEscape = getLabDeadEndEscape(state, neighbourX, neighbourY)
  if (!neighbourEscape) return false
  return neighbourEscape !== labDirections[dirFromCurrent]?.back
}
function getLabKnownFrontierEscapeDir(state, x, y) {
  const candidates = []
  for (const [dir, delta] of labDirectionEntries) {
    const nx = x + delta.dx
    const ny = y + delta.dy
    if (!isLabSameQuadrantMove(state, x, y, nx, ny)) continue
    if (isLabWorseQuadrantMove(state, x, y, nx, ny)) continue
    const neighbour = state?.rooms?.[getLabKey(nx, ny)]
    const back = labDirections[dir].back
    if (neighbour?.explored && neighbour.exits?.[back] === true) {
      candidates.push({
        dir,
        protectedRank: isLabProtectedDeadAreaCell(state, nx, ny) ? 0 : 1,
        deadRank: isLabDeadEndRoom(state, nx, ny) ? 1 : 0,
        pathLength: Array.isArray(neighbour.path) ? neighbour.path.length : 9999,
        dirIndex: labDirectionIndex[dir] ?? 99
      })
    }
  }
  candidates.sort((a, b) => a.protectedRank - b.protectedRank
    || a.deadRank - b.deadRank
    || a.pathLength - b.pathLength
    || a.dirIndex - b.dirIndex)
  return candidates[0]?.dir ?? ""
}
function reevaluateLabDeadEnd(state, x, y) {
  // Recompute (x, y)'s dead status from current room exits + neighbour
  // dead flags.  Returns true iff the result differs from the previous
  // value (so the caller can decide to propagate).  Never marks protected
  // endpoint cells.
  const key = getLabKey(x, y)
  const room = state?.rooms?.[key]
  if (!room?.explored || !room.exits) return false
  const context = getLabInfluenceContext(state)
  if (isLabProtectedDeadAreaCell(state, x, y, context)) return false
  if (state.layout && Number.isInteger(state.layout.finishX) && Number.isInteger(state.layout.finishY)
    && state.layout.finishX === x && state.layout.finishY === y) return false
  const wasDead = isLabDeadEndRoom(state, x, y)
  const previousEscape = wasDead ? getLabDeadEndEscape(state, x, y) : null
  const deadRouteOptions = { allowStartSubquadrantExplored: true }
  const layout = state.layout
  const routeGate = createLabMoveGate(state, { context })
  let survivingDir = ""
  let survivingCount = 0
  let survivingFrontierCount = 0
  let survivingQuadrantExitCount = 0
  for (const [dir, delta] of labDirectionEntries) {
    if (room.exits?.[dir] !== true) continue
    const nx = x + delta.dx
    const ny = y + delta.dy
    if (layout && (nx < layout.minX || nx > layout.maxX || ny < layout.minY || ny > layout.maxY)) continue
    if (isLabWorseQuadrantMove(state, x, y, nx, ny, context)) continue
    if (!isLabSameQuadrantMove(state, x, y, nx, ny, context)) {
      if (!isLabLiveQuadrantCrossing(state, x, y, dir, context)) continue
      survivingCount++
      survivingQuadrantExitCount++
      survivingDir = dir
      continue
    }
    const neighbourDead = isLabDeadEndRoom(state, nx, ny)
    if (neighbourDead && (!wasDead || previousEscape !== dir || !canLabDeadNeighbourCarryEscape(state, dir, nx, ny))) continue
    const neighbour = state.rooms?.[getLabKey(nx, ny)]
    if (neighbour?.explored !== true) {
      if (!hasLabPotentialRouteToLiveTarget(state, nx, ny, routeGate, context, { ...deadRouteOptions, boundQuadrant: true, forceRefresh: true, originX: nx, originY: ny })) {
        appendLabDeadEndEntry(state, getLabKey(nx, ny), labDirections[dir].back)
        continue
      }
      survivingFrontierCount++
    }
    survivingCount++
    survivingDir = dir
  }
  // If ANY surviving exit points at an unexplored frontier, the cell is
  // not yet a dead-end — that frontier might lead to anywhere, including
  // the goal.  Hold off on marking until enough exploration has resolved
  // every neighbour into either a confirmed dead cell or a confirmed
  // alive (explored) one.
  if (survivingFrontierCount > 0) {
    return false
  }
  if (survivingQuadrantExitCount > 0) {
    return false
  }
  if (survivingCount >= 2) {
    return false
  }
  // 0 or 1 surviving live exits.  Default: mark dead with escape =
  // surviving dir (or "" when fully sealed).  Only true live endpoints
  // keep this room alive; the start subquadrant is traversable, not a goal.
  if (survivingCount === 1 && context) {
    const delta = labDirections[survivingDir]
    const sx = x + (delta?.dx ?? 0)
    const sy = y + (delta?.dy ?? 0)
    if (isLabProtectedDeadSurvivalCell(state, sx, sy, context)) {
      return false
    }
  }
  const nextEscape = survivingCount === 1 ? survivingDir : ""
  if (wasDead && previousEscape === nextEscape) return false
  return appendLabDeadEndEntry(state, key, nextEscape)
}
// Predictive dead-end marker for an UNEXPLORED frontier cell.  Explored
// neighbours are treated as blocked for the potential-route check; the
// frontier only stays live if unknown space can still reach a goalward
// quadrant border pathway or the exit area.
function evaluateLabFrontierLeaf(state, x, y) {
  if (!state?.layout) return false
  const key = getLabKey(x, y)
  const room = state.rooms?.[key]
  if (!room || room.explored) return false
  if (Number.isInteger(state.layout.finishX) && Number.isInteger(state.layout.finishY)
    && state.layout.finishX === x && state.layout.finishY === y) return false
  if (isLabDeadEndRoom(state, x, y)) return false
  // Frontier cells INSIDE the exit sub-quadrant are part of the goal
  // area and must stay reachable — even one-opening pockets there
  // could turn out to be the gateway to the exit cell once explored.
  const context = getLabInfluenceContext(state)
  if (isLabProtectedDeadAreaCell(state, x, y, context)) return false
  if (context && isLabInExitSubquadrant(x, y, context)) return false
  if (context && isLabInStartSubquadrant(x, y, context)) return false
  const routeGate = createLabMoveGate(state, { context })
  if (hasLabPotentialRouteToLiveTarget(state, x, y, routeGate, context, { allowStartSubquadrantExplored: true, boundQuadrant: true, forceRefresh: true, originX: x, originY: y })) return false
  const escapeDir = getLabKnownFrontierEscapeDir(state, x, y)
  const delta = labDirections[escapeDir]
  if (!appendLabDeadEndEntry(state, key, escapeDir)) return false
  if (delta) propagateLabDeadEndFromRoom(state, x + delta.dx, y + delta.dy)
  return true
}
function evaluateLabFrontierLeavesAround(state, x, y) {
  if (!state?.layout) return false
  let changed = false
  for (const [, delta] of labDirectionEntries) {
    if (evaluateLabFrontierLeaf(state, x + delta.dx, y + delta.dy)) changed = true
  }
  return changed
}
function isLabPotentialTouchingExploredBlocked(state, x, y, fromX, fromY, context = getLabInfluenceContext(state), options = {}) {
  if (!state?.rooms || !context) return false
  if (!Number.isInteger(x) || !Number.isInteger(y)) return true
  if (options?.originX === x && options?.originY === y) return false
  if (isLabProtectedDeadAreaCell(state, x, y, context)) return false
  const room = state.rooms[getLabKey(x, y)]
  if (room?.explored === true) return false
  const allowStartExplored = (options?.allowStartSubquadrantExplored === true || options?.allowStartQuadrantExplored === true)
    && Number.isInteger(options?.originX)
    && Number.isInteger(options?.originY)
    && isLabInStartSubquadrant(options.originX, options.originY, context)
    && isLabInStartSubquadrant(x, y, context)
  if (allowStartExplored) return false
  if (isLabInExitSubquadrant(x, y, context)) return false
  for (const [dir, delta] of labDirectionEntries) {
    const nx = x + delta.dx
    const ny = y + delta.dy
    if (nx === fromX && ny === fromY) continue
    const neighbour = state.rooms[getLabKey(nx, ny)]
    const back = labDirections[dir].back
    if (neighbour?.explored === true && neighbour.exits?.[back] === true) return true
  }
  return false
}
function getLabDirectionBetween(fromX, fromY, toX, toY) {
  for (const [dir, delta] of labDirectionEntries) {
    if (fromX + delta.dx === toX && fromY + delta.dy === toY) return dir
  }
  return ""
}
function isLabProtectedDeadAreaCell(state, x, y, context = getLabInfluenceContext(state)) {
  const key = getLabKey(x, y)
  if (state?.layout && Number.isInteger(state.layout.finishX) && Number.isInteger(state.layout.finishY)
    && state.layout.finishX === x && state.layout.finishY === y) return true
  if (isLabKnownQuadrantGatewayCell(state, x, y)) return true
  if (Array.isArray(state?.startKeys) && state.startKeys.includes(key)) {
    return Boolean(context && isLabInStartSubquadrant(x, y, context))
  }
  const room = state?.rooms?.[key]
  return Boolean(context
    && room?.explored !== true
    && (isLabInExitSubquadrant(x, y, context) || isLabInStartSubquadrant(x, y, context)))
}
function isLabProtectedDeadSurvivalCell(state, x, y, context = getLabInfluenceContext(state)) {
  if (state?.layout && Number.isInteger(state.layout.finishX) && Number.isInteger(state.layout.finishY)
    && state.layout.finishX === x && state.layout.finishY === y) return true
  if (isLabKnownQuadrantGatewayCell(state, x, y)) return true
  const room = state?.rooms?.[getLabKey(x, y)]
  return Boolean(context && room?.explored !== true && isLabInExitSubquadrant(x, y, context))
}
function pruneLabProtectedDeadMarks(state) {
  ensureLabDeadEndEntries(state)
  return false
}
function getLabDeadAreaEdgeCacheKey(state, sourceX, sourceY, dir, context = getLabInfluenceContext(state)) {
  const signature = `${getLabInfluenceSignature(context)}|${getLabQuadrantGatewaySignature(state)}`
  return `${signature}|${getLabKey(sourceX, sourceY)}:${dir}`
}
function setLabDeadAreaEdgeCached(state, sourceX, sourceY, dir, status, context = getLabInfluenceContext(state)) {
  if (!state || !labDirections[dir]) return false
  ensureLabDeadAreaEdgeCache(state)[getLabDeadAreaEdgeCacheKey(state, sourceX, sourceY, dir, context)] = status
  return true
}
function getLabDeadAreaEdgeCached(state, sourceX, sourceY, dir, context = getLabInfluenceContext(state)) {
  if (!state || !labDirections[dir]) return ""
  return ensureLabDeadAreaEdgeCache(state)[getLabDeadAreaEdgeCacheKey(state, sourceX, sourceY, dir, context)] ?? ""
}
function markLabDeadAreaFromEdge(state, sourceX, sourceY, dir, context = getLabInfluenceContext(state)) {
  const cached = getLabDeadAreaEdgeCached(state, sourceX, sourceY, dir, context)
  if (cached === "closed" || cached === "blocked") return false
  const sourceRoom = state?.rooms?.[getLabKey(sourceX, sourceY)]
  const delta = labDirections[dir]
  const layout = state?.layout
  if (!sourceRoom?.explored || !delta || !layout) return false
  if (sourceRoom.exits?.[dir] !== true) {
    if (sourceRoom.exits?.[dir] === false) setLabDeadAreaEdgeCached(state, sourceX, sourceY, dir, "blocked", context)
    return false
  }
  const startX = sourceX + delta.dx
  const startY = sourceY + delta.dy
  if (startX < layout.minX || startX > layout.maxX || startY < layout.minY || startY > layout.maxY) {
    setLabDeadAreaEdgeCached(state, sourceX, sourceY, dir, "blocked", context)
    return false
  }
  if (!isLabSameQuadrantMove(state, sourceX, sourceY, startX, startY, context)) {
    if (isLabLiveQuadrantCrossing(state, sourceX, sourceY, dir, context)) return false
    setLabDeadAreaEdgeCached(state, sourceX, sourceY, dir, "blocked", context)
    return false
  }
  if (isLabWorseQuadrantMove(state, sourceX, sourceY, startX, startY, context)) {
    setLabDeadAreaEdgeCached(state, sourceX, sourceY, dir, "blocked", context)
    return false
  }
  const sourceKey = getLabKey(sourceX, sourceY)
  const startKey = getLabKey(startX, startY)
  const startRoom = state.rooms?.[startKey]
  if (!startRoom || isLabProtectedDeadAreaCell(state, startX, startY, context)) return false

  const queue = [{ x: startX, y: startY, key: startKey, escape: delta.back }]
  const seen = new Set([sourceKey])
  const branchRooms = []
  let head = 0
  while (head < queue.length) {
    const node = queue[head++]
    if (seen.has(node.key)) continue
    seen.add(node.key)
    const room = state.rooms?.[node.key]
    if (!room) return false
    if (!room.explored) {
      if (!isLabDeadEndRoom(state, node.x, node.y)) return false
      continue
    }
    if (isLabProtectedDeadAreaCell(state, node.x, node.y, context)) return false
    branchRooms.push(node)
    for (const [nextDir, nextDelta] of labDirectionEntries) {
      if (room.exits?.[nextDir] !== true) continue
      const nx = node.x + nextDelta.dx
      const ny = node.y + nextDelta.dy
      if (nx < layout.minX || nx > layout.maxX || ny < layout.minY || ny > layout.maxY) return false
      if (!isLabSameQuadrantMove(state, node.x, node.y, nx, ny, context)) {
        if (isLabLiveQuadrantCrossing(state, node.x, node.y, nextDir, context)) return false
        continue
      }
      if (isLabWorseQuadrantMove(state, node.x, node.y, nx, ny, context)) continue
      const nextKey = getLabKey(nx, ny)
      if (seen.has(nextKey)) continue
      const nextRoom = state.rooms?.[nextKey]
      if (!nextRoom) return false
      if (!nextRoom.explored && !isLabDeadEndRoom(state, nx, ny)) return false
      queue.push({ x: nx, y: ny, key: nextKey, escape: getLabDirectionBetween(nx, ny, node.x, node.y) })
    }
  }
  if (branchRooms.length === 0) return false
  let changed = false
  for (const room of branchRooms) {
    if (!room.escape || isLabProtectedDeadAreaCell(state, room.x, room.y, context)) continue
    if (appendLabDeadEndEntry(state, room.key, room.escape)) changed = true
  }
  setLabDeadAreaEdgeCached(state, sourceX, sourceY, dir, "closed", context)
  return changed
}
function evaluateLabDeadAreasAround(state, x, y) {
  if (!state?.layout) return false
  const context = getLabInfluenceContext(state)
  enqueueLabDeadAreaAround(state, x, y, context)
  const sourceKeys = new Set([getLabKey(x, y)])
  const seedRoom = state.rooms?.[getLabKey(x, y)]
  if (seedRoom?.explored && seedRoom.exits) {
    for (const [, delta] of labDirectionEntries) {
      const neighbour = state.rooms?.[getLabKey(x + delta.dx, y + delta.dy)]
      if (neighbour?.explored && isLabSameQuadrantMove(state, x, y, neighbour.x, neighbour.y, context)) {
        sourceKeys.add(getLabKey(neighbour.x, neighbour.y))
      }
    }
  }
  let changed = false
  for (const key of sourceKeys) {
    const room = state.rooms?.[key]
    if (!room?.explored || !room.exits) continue
    for (const [dir] of labDirectionEntries) {
      if (markLabDeadAreaFromEdge(state, room.x, room.y, dir, context)) changed = true
    }
  }
  if (changed) {
    for (const key of sourceKeys) {
      const room = state.rooms?.[key]
      if (room?.explored) propagateLabDeadEndFromRoom(state, room.x, room.y)
    }
  }
  return changed
}
function drainLabDeadAreaQueue(state, context = getLabInfluenceContext(state), budget = labDeadAreaDrainBudget) {
  if (!state?.layout || !state.rooms || !context) return false
  const queue = ensureLabDeadAreaQueue(state)
  let changed = false
  let processed = 0
  while (queue.length > 0 && processed < budget) {
    const key = queue.pop()
    processed++
    if (state.deadAreaQueued) delete state.deadAreaQueued[key]
    if (typeof key !== "string" || !key) continue
    const room = state.rooms[key]
    if (!room?.explored || !room.exits) continue
    let sourceChanged = false
    if (evaluateLabFrontierLeavesAround(state, room.x, room.y)) sourceChanged = true
    for (const [dir] of labDirectionEntries) {
      if (markLabDeadAreaFromEdge(state, room.x, room.y, dir, context)) sourceChanged = true
    }
    if (reevaluateLabDeadEnd(state, room.x, room.y)) sourceChanged = true
    if (sourceChanged) {
      changed = true
      propagateLabDeadEndFromRoom(state, room.x, room.y)
    }
  }
  return changed
}
function propagateLabDeadEndFromRoom(state, x, y) {
  const queue = [getLabKey(x, y)]
  const seen = new Set()
  const context = getLabInfluenceContext(state)
  let head = 0
  while (head < queue.length) {
    const key = queue[head++]
    if (seen.has(key)) continue
    seen.add(key)
    const coords = getLabCoordsFromKey(key)
    if (!coords) continue
    const cellX = coords[0]
    const cellY = coords[1]
    if (!reevaluateLabDeadEnd(state, cellX, cellY)) continue
    const room = state?.rooms?.[key]
    if (!room?.explored || !room.exits) continue
    for (const [dir, delta] of labDirectionEntries) {
      if (room.exits?.[dir] !== true) continue
      if (!isLabSameQuadrantMove(state, cellX, cellY, cellX + delta.dx, cellY + delta.dy, context)) continue
      if (isLabWorseQuadrantMove(state, cellX, cellY, cellX + delta.dx, cellY + delta.dy, context)) continue
      const nkey = getLabKey(cellX + delta.dx, cellY + delta.dy)
      if (!seen.has(nkey)) queue.push(nkey)
    }
  }
}
function getLabDeadCheckKey(state, x, y, context = getLabInfluenceContext(state)) {
  const signature = `${getLabInfluenceSignature(context)}|${getLabQuadrantGatewaySignature(state)}`
  return `${signature}|${getLabKey(x, y)}`
}
function getLabRoomExitSignature(room) {
  if (!room?.exits) return ""
  return labDirectionEntries.map(([dir]) => room.exits?.[dir] === true ? "1" : "0").join("")
}
function updateLabDeadKnowledgeFromRoom(state, x, y, context = getLabInfluenceContext(state)) {
  if (!state?.rooms || !Number.isInteger(x) || !Number.isInteger(y)) return false
  const room = state.rooms[getLabKey(x, y)]
  if (!room?.explored || !room.exits) return false
  const key = getLabDeadCheckKey(state, x, y, context)
  const exitSignature = getLabRoomExitSignature(room)
  const checks = ensureLabDeadKnowledgeChecks(state)
  if (checks[key] === exitSignature) return false
  checks[key] = exitSignature
  ensureLabDeadPrefilterChecks(state)[key] = exitSignature
  let changed = evaluateLabFrontierLeavesAround(state, x, y)
  if (evaluateLabDeadAreasAround(state, x, y)) changed = true
  propagateLabDeadEndFromRoom(state, x, y)
  if (drainLabDeadAreaQueue(state, context)) changed = true
  return changed
}
function prepareLabDeadRoomMoveFilter(state, x, y, context = getLabInfluenceContext(state)) {
  if (!state?.rooms || !Number.isInteger(x) || !Number.isInteger(y)) return false
  let changed = drainLabDeadAreaQueue(state, context)
  const room = state.rooms[getLabKey(x, y)]
  if (!room?.explored || !room.exits) return changed
  const key = getLabDeadCheckKey(state, x, y, context)
  const exitSignature = getLabRoomExitSignature(room)
  if (ensureLabDeadKnowledgeChecks(state)[key] === exitSignature) return changed
  const checks = ensureLabDeadPrefilterChecks(state)
  if (checks[key] === exitSignature) return changed
  checks[key] = exitSignature
  if (evaluateLabFrontierLeavesAround(state, x, y)) changed = true
  enqueueLabDeadAreaAround(state, x, y, context)
  if (drainLabDeadAreaQueue(state, context)) changed = true
  return changed
}

// ============================================================================
// pickGreedyStep — direction picker with the priority chain
//
//   FORCED ESCAPE.  If the current cell is a marked dead-end with a non-
//   empty escape direction, return that direction immediately.  Workers
//   entering a dead-end pocket (including new workers spawning into one)
//   take the recorded one-way exit without re-deriving anything.
//
//   ALL-EXPLORED COST GATE.  If every gated exit in the current choice set
//   has already been explored, choose the lowest cached dead-route cost.
//   This reads deadRouteCosts only; it does not run a fresh BFS.
//
//   PRIORITY 1 — goal-forward.  Any open exit that's in the influence
//   context's goalDirs (toward the cross-quadrant boundary or, inside
//   the goal quadrant, toward the exit corner).  Excludes the back
//   direction.  Ties broken by: unexplored neighbour first; when both
//   candidates are unexplored inside this same picker tier, lowest
//   dead-route potential cost; then lowest labDirectionIndex
//   (north < east < south < west) for deterministic choices.
//
//   PRIORITY 2 — side-forward.  Open exits that are not goal-forward and
//   not the back direction.  Same-tier tiebreakers match priority 1.
//
//   PRIORITY 3 — backstep.  Only fires when both priorities above are
//   empty.  Uses the visit-stack inverse so the worker retraces exactly
//   the path it walked.
//
// Dead-end gating: candidates whose neighbour cell is in the
// deadEndEntries section are filtered out unless they cross quadrants or
// follow a recorded dead-area escape.
// ============================================================================
function getLabPickSkipSet(options = {}) {
  const skipKeys = options?.skipKeys
  if (skipKeys instanceof Set) return skipKeys
  if (Array.isArray(skipKeys)) return new Set(skipKeys)
  return null
}
function isLabPickSkipped(skipKeys, x, y) {
  return skipKeys instanceof Set && skipKeys.has(getLabKey(x, y))
}
function isLabPotentialGoalCell(state, x, y, context = getLabInfluenceContext(state)) {
  const layout = state?.layout
  if (!layout) return false
  if (Number.isInteger(layout.finishX) && Number.isInteger(layout.finishY)) {
    return x === layout.finishX && y === layout.finishY
  }
  if (context && isLabInExitSubquadrant(x, y, context)) return true
  return x === layout.goalX && y === layout.goalY
}
function isLabPotentialQuadrantBorderPathway(state, x, y, gate, context = gate?.context ?? getLabInfluenceContext(state)) {
  const layout = state?.layout
  if (!layout || !context) return false
  if (x < layout.minX || x > layout.maxX || y < layout.minY || y > layout.maxY) return false
  for (const [dir] of labDirectionEntries) {
    const crossing = getLabQuadrantTransitionForDir(state, x, y, dir, context)
    if (!crossing) continue
    if (!isLabLiveQuadrantCrossing(state, x, y, dir, context)) continue
    const gateResult = gate?.check
      ? gate.check(x, y, dir, { ignoreSkip: true })
      : createLabMoveGate(state, { context }).check(x, y, dir, { ignoreSkip: true })
    if (gateResult.allowed === true) return true
  }
  return false
}
function isLabPotentialLiveTarget(state, x, y, gate, context = gate?.context ?? getLabInfluenceContext(state), options = {}) {
  return isLabPotentialGoalCell(state, x, y, context)
    || isLabPotentialQuadrantBorderPathway(state, x, y, gate, context)
}
function canLabPotentialTraverse(state, x, y, dir, gate, context = getLabInfluenceContext(state), options = {}) {
  const delta = labDirections[dir]
  const layout = state?.layout
  if (!delta || !layout) return false
  const nx = x + delta.dx
  const ny = y + delta.dy
  if (nx < layout.minX || nx > layout.maxX || ny < layout.minY || ny > layout.maxY) return false
  const originX = Number.isInteger(options.originX) ? options.originX : x
  const originY = Number.isInteger(options.originY) ? options.originY : y
  if (options?.boundQuadrant === true) {
    if (!isLabSameQuadrantCell(state, originX, originY, nx, ny, context)) return false
  }
  const room = state.rooms?.[getLabKey(x, y)]
  const allowExitExplored = Boolean(context && isLabInExitSubquadrant(x, y, context))
  const allowStartExplored = (options?.allowStartSubquadrantExplored === true || options?.allowStartQuadrantExplored === true)
    && context
    && isLabInStartSubquadrant(originX, originY, context)
    && isLabInStartSubquadrant(x, y, context)
  if (!allowStartExplored && !allowExitExplored && room?.explored === true) return false
  if (room?.explored && room.exits?.[dir] !== true) return false
  const nextRoom = state.rooms?.[getLabKey(nx, ny)]
  const nextAllowExitExplored = Boolean(context && isLabInExitSubquadrant(nx, ny, context))
  if (!allowStartExplored && !nextAllowExitExplored && nextRoom?.explored === true) return false
  if (nextRoom?.explored !== true && isLabPotentialTouchingExploredBlocked(state, nx, ny, x, y, context, options)) return false
  const back = labDirections[dir].back
  if (nextRoom?.explored && nextRoom.exits?.[back] === false) return false
  const gateResult = gate?.check
    ? gate.check(x, y, dir, { ignoreSkip: true })
    : createLabMoveGate(state, { context }).check(x, y, dir, { ignoreSkip: true })
  return gateResult.allowed === true
}
function hasLabPotentialRouteToLiveTarget(state, startX, startY, gate, context = gate?.context ?? getLabInfluenceContext(state), options = {}) {
  return Number.isFinite(getLabPotentialGoalCost(state, startX, startY, gate, context, options))
}
function backfillLabPotentialGoalCosts(state, targetKeys, visitedKeys, routeGate, context, options = {}) {
  if (!state || !(visitedKeys instanceof Set) || !Array.isArray(targetKeys) || targetKeys.length === 0) return false
  const queue = []
  const distances = new Map()
  for (const key of targetKeys) {
    if (!visitedKeys.has(key) || distances.has(key)) continue
    const coords = getLabCoordsFromKey(key)
    if (!coords) continue
    distances.set(key, 0)
    queue.push({ x: coords[0], y: coords[1], key, distance: 0 })
  }
  let head = 0
  while (head < queue.length) {
    const node = queue[head++]
    for (const [dir, delta] of labDirectionEntries) {
      const px = node.x - delta.dx
      const py = node.y - delta.dy
      const pkey = getLabKey(px, py)
      if (!visitedKeys.has(pkey) || distances.has(pkey)) continue
      if (!canLabPotentialTraverse(state, px, py, dir, routeGate, context, options)) continue
      const distance = node.distance + 1
      distances.set(pkey, distance)
      queue.push({ x: px, y: py, key: pkey, distance })
    }
  }
  for (const key of visitedKeys) {
    const coords = getLabCoordsFromKey(key)
    if (!coords) continue
    setLabDeadRouteCost(state, coords[0], coords[1], distances.has(key) ? distances.get(key) : Number.POSITIVE_INFINITY)
  }
  return true
}
function getLabPotentialGoalCost(state, startX, startY, gate, context = gate?.context ?? getLabInfluenceContext(state), options = {}) {
  const layout = state?.layout
  const routeGate = gate?.check ? gate : createLabMoveGate(state, { context })
  if (options?.forceRefresh !== true && hasLabDeadRouteCost(state, startX, startY)) {
    return getLabDeadRouteCost(state, startX, startY)
  }
  const remember = (cost) => {
    setLabDeadRouteCost(state, startX, startY, cost)
    return cost
  }
  if (!layout || !Number.isInteger(startX) || !Number.isInteger(startY)) return remember(Number.POSITIVE_INFINITY)
  if (startX < layout.minX || startX > layout.maxX || startY < layout.minY || startY > layout.maxY) return remember(Number.POSITIVE_INFINITY)
  if (routeGate.isDeadRoom?.(startX, startY) === true) return remember(Number.POSITIVE_INFINITY)
  const routeOptions = options?.boundQuadrant === true && (!Number.isInteger(options.originX) || !Number.isInteger(options.originY))
    ? { ...options, originX: startX, originY: startY }
    : options
  if (isLabPotentialLiveTarget(state, startX, startY, routeGate, context, routeOptions)) return remember(0)
  const startKey = getLabKey(startX, startY)
  const visited = new Set([startKey])
  const targetKeys = []
  const queue = [{ x: startX, y: startY, key: startKey, distance: 0 }]
  let bestDistance = Number.POSITIVE_INFINITY
  let head = 0
  while (head < queue.length) {
    const node = queue[head++]
    if (isLabPotentialLiveTarget(state, node.x, node.y, routeGate, context, routeOptions)) {
      targetKeys.push(node.key)
      if (node.distance < bestDistance) bestDistance = node.distance
    }
    for (const [dir, delta] of labDirectionEntries) {
      if (!canLabPotentialTraverse(state, node.x, node.y, dir, routeGate, context, routeOptions)) continue
      const nx = node.x + delta.dx
      const ny = node.y + delta.dy
      const key = getLabKey(nx, ny)
      if (visited.has(key)) continue
      if (routeGate.isDeadRoom?.(nx, ny) === true) continue
      const distance = node.distance + 1
      visited.add(key)
      queue.push({ x: nx, y: ny, key, distance })
    }
  }
  if (targetKeys.length > 0) {
    backfillLabPotentialGoalCosts(state, targetKeys, visited, routeGate, context, routeOptions)
    return remember(bestDistance)
  }
  for (const key of visited) {
    const coords = getLabCoordsFromKey(key)
    if (coords) setLabDeadRouteCost(state, coords[0], coords[1], Number.POSITIVE_INFINITY)
  }
  return remember(Number.POSITIVE_INFINITY)
}
function getLabMovePotentialCost(state, move, gate, context = gate?.context ?? getLabInfluenceContext(state), options = {}) {
  if (!move) return Number.POSITIVE_INFINITY
  return getLabDeadRouteCost(state, move.x, move.y)
}
function isLabKnownDeadPotentialCell(state, x, y, context = getLabInfluenceContext(state)) {
  if (!hasLabDeadRouteCost(state, x, y)) return false
  if (isLabProtectedDeadAreaCell(state, x, y, context)) return false
  return !Number.isFinite(getLabDeadRouteCost(state, x, y))
}
function isLabDeadMovePrefilterBlocked(state, currentX, currentY, dir, gate, context = gate?.context ?? getLabInfluenceContext(state)) {
  const delta = labDirections[dir]
  if (!delta) return true
  const nextX = currentX + delta.dx
  const nextY = currentY + delta.dy
  const crossing = getLabQuadrantTransitionForDir(state, currentX, currentY, dir, context)
  if (crossing) return !isLabLiveQuadrantCrossing(state, currentX, currentY, dir, context)
  const targetDead = gate?.isDeadRoom
    ? gate.isDeadRoom(nextX, nextY)
    : isLabDeadEndRoom(state, nextX, nextY)
  if (!targetDead && !isLabKnownDeadPotentialCell(state, nextX, nextY, context)) return false
  const currentDead = gate?.isDeadRoom
    ? gate.isDeadRoom(currentX, currentY)
    : isLabDeadEndRoom(state, currentX, currentY)
  if (!currentDead) return true
  const escape = gate?.getEscape ? gate.getEscape(currentX, currentY) : getLabDeadEndEscape(state, currentX, currentY)
  return !(escape && escape === dir && canLabDeadEscapeReachOpen(state, currentX, currentY, dir, context))
}
function addLabPotentialMoveCosts(state, moves, gate, options = {}) {
  if (!Array.isArray(moves) || moves.length === 0) return moves
  const context = gate?.context ?? getLabInfluenceContext(state)
  const costCache = new Map()
  const knownCache = new Map()
  for (const move of moves) {
    if (!move) continue
    const key = getLabKey(move.x, move.y)
    if (!costCache.has(key)) costCache.set(key, getLabMovePotentialCost(state, move, gate, context, options))
    if (!knownCache.has(key)) knownCache.set(key, hasLabDeadRouteCost(state, move.x, move.y))
    move.potentialCost = costCache.get(key)
    move.potentialCostKnown = knownCache.get(key)
  }
  return moves
}
function getLabPotentialCostRank(candidate) {
  return Number.isFinite(candidate?.potentialCost) ? candidate.potentialCost : Number.POSITIVE_INFINITY
}
function compareLabStepCandidate(a, b) {
  const exitFocusDelta = (a.exitFocusRank ?? 0) - (b.exitFocusRank ?? 0)
  if (exitFocusDelta !== 0) return exitFocusDelta
  if (a.explored !== b.explored) return a.explored ? 1 : -1
  // Dead-route cost is only a same-tier tiebreaker for two unexplored choices.
  // The caller must split candidates into movement tiers before sorting here.
  if (a.explored === false && b.explored === false) {
    const potentialA = getLabPotentialCostRank(a)
    const potentialB = getLabPotentialCostRank(b)
    if (potentialA !== potentialB) return potentialA - potentialB
  }
  return (a.dirIndex ?? 99) - (b.dirIndex ?? 99)
}
function pickFirstLabCandidate(candidates) {
  if (candidates.length === 0) return null
  candidates.sort(compareLabStepCandidate)
  const pick = candidates[0]
  return { x: pick.x, y: pick.y, dir: pick.dir, backstep: Boolean(pick.isBack) }
}
function compareLabExploredCostCandidate(a, b) {
  const exitFocusDelta = (a.exitFocusRank ?? 0) - (b.exitFocusRank ?? 0)
  if (exitFocusDelta !== 0) return exitFocusDelta
  const potentialA = getLabPotentialCostRank(a)
  const potentialB = getLabPotentialCostRank(b)
  if (potentialA !== potentialB) return potentialA - potentialB
  return (a.dirIndex ?? 99) - (b.dirIndex ?? 99)
}
function pickFirstLabExploredCostCandidate(candidates) {
  if (candidates.length === 0 || candidates.some((move) => move?.explored !== true)) return null
  candidates.sort(compareLabExploredCostCandidate)
  const pick = candidates[0]
  return { x: pick.x, y: pick.y, dir: pick.dir, backstep: Boolean(pick.isBack) }
}
function getLabGoalDirRank(dir, goalDirs) {
  const rank = Array.isArray(goalDirs) ? goalDirs.indexOf(dir) : -1
  return rank >= 0 ? rank : 99
}
function getLabMoveGoalRank(move, goalDirs) {
  if (move?.gateway) return -1
  return getLabGoalDirRank(move?.dir, goalDirs)
}
function compareLabGoalCandidate(a, b, _goalDirs) {
  return compareLabStepCandidate(a, b)
}
function pickFirstLabGoalCandidate(candidates, goalDirs) {
  if (candidates.length === 0) return null
  candidates.sort((a, b) => compareLabGoalCandidate(a, b, goalDirs))
  const pick = candidates[0]
  return { x: pick.x, y: pick.y, dir: pick.dir, backstep: false }
}
function pickFirstLabAllowedForwardCandidate(candidates) {
  const moves = candidates.filter((move) => !move.isBack)
  if (moves.length === 0) return null
  const unexploredPick = pickFirstLabCandidate(moves.filter((move) => !move.explored))
  if (unexploredPick) return unexploredPick
  const liveExploredPick = pickFirstLabExploredCostCandidate(moves)
  if (liveExploredPick) return liveExploredPick
  return pickFirstLabCandidate(moves)
}
function pickLabExitSubquadrantForwardMove(eligibleMoves, goalDirs, context = null, options = {}) {
  const forwardMoves = eligibleMoves.filter((move) => !move.isBack)
  const moves = options?.stayInExitSubquadrant === true && context
    ? forwardMoves.filter((move) => isLabInExitSubquadrant(move.x, move.y, context))
    : forwardMoves
  if (moves.length === 0) return null
  if (Array.isArray(goalDirs) && goalDirs.length > 0) {
    const goalForwardMoves = moves.filter((move) => goalDirs.includes(move.dir))
    const unexploredGoalForward = goalForwardMoves.filter((move) => !move.explored)
    const goalPick = unexploredGoalForward.length > 0
      ? pickFirstLabCandidate(unexploredGoalForward)
      : pickFirstLabExploredCostCandidate(goalForwardMoves)
    if (goalPick) return goalPick
  }
  const unexploredForward = moves.filter((move) => !move.explored)
  const unexploredPick = pickFirstLabCandidate(unexploredForward)
  if (unexploredPick) return unexploredPick
  return pickFirstLabExploredCostCandidate(moves) ?? pickFirstLabCandidate(moves)
}
function getLabEligibleMovesForRoom(state, x, y, gate, options = {}) {
  const room = state?.rooms?.[getLabKey(x, y)]
  if (!room?.explored || !room.exits) return []
  const layout = state.layout
  const backDir = typeof options?.backDir === "string" ? options.backDir : ""
  const moves = []
  for (const [dir, delta] of labDirectionEntries) {
    if (room.exits?.[dir] !== true) continue
    const nx = x + delta.dx
    const ny = y + delta.dy
    if (layout && (nx < layout.minX || nx > layout.maxX || ny < layout.minY || ny > layout.maxY)) continue
    if (isLabDeadMovePrefilterBlocked(state, x, y, dir, gate, gate.context)) continue
    const isBack = Boolean(backDir && dir === backDir)
    const gateResult = gate.check(x, y, dir, { ignoreSkip: isBack })
    if (!gateResult.allowed) continue
    const nextRoom = state.rooms?.[getLabKey(nx, ny)]
    moves.push({
      dir,
      x: nx,
      y: ny,
      explored: nextRoom?.explored === true,
      dirIndex: labDirectionIndex[dir] ?? 99,
      isBack,
      gateway: gateResult.gateway === true,
      exitFocusRank: getLabExitFocusMoveRank(state, x, y, nx, ny, gate.context)
    })
  }
  return moves
}
function getLabEmergencyDeadEscapeMove(state, x, y, backDir = "", context = getLabInfluenceContext(state)) {
  const room = state?.rooms?.[getLabKey(x, y)]
  const layout = state?.layout
  if (!room?.explored || !room.exits || !layout) return null
  const candidates = []
  for (const [dir, delta] of labDirectionEntries) {
    if (room.exits?.[dir] !== true) continue
    const nx = x + delta.dx
    const ny = y + delta.dy
    if (nx < layout.minX || nx > layout.maxX || ny < layout.minY || ny > layout.maxY) continue
    if (!isLabSameQuadrantMove(state, x, y, nx, ny, context)) continue
    if (isLabWorseQuadrantMove(state, x, y, nx, ny, context)) continue
    if (!isLabDeadEndRoom(state, nx, ny)) continue
    if (!canLabDeadEscapeReachOpen(state, x, y, dir, context)) continue
    candidates.push({
      dir,
      x: nx,
      y: ny,
      backRank: backDir && dir === backDir ? 0 : 1,
      dirIndex: labDirectionIndex[dir] ?? 99
    })
  }
  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.backRank - b.backRank || a.dirIndex - b.dirIndex)
  const pick = candidates[0]
  appendLabDeadEndEntry(state, getLabKey(x, y), pick.dir)
  return { x: pick.x, y: pick.y, dir: pick.dir, backstep: Boolean(backDir && pick.dir === backDir) }
}
function getLabFrontierRouteCacheKey(state, x, y, context = getLabInfluenceContext(state), cacheScope = "") {
  const gatewaySignature = getLabQuadrantGatewaySignature(state)
  const scope = typeof cacheScope === "string" && cacheScope ? `|${cacheScope}` : ""
  const signature = `${getLabInfluenceSignature(context)}|${gatewaySignature}${scope}`
  return signature ? `${signature}|${getLabKey(x, y)}` : getLabKey(x, y)
}
function getCachedLabFrontierRoute(state, x, y, gate, backDir = "", options = {}) {
  const context = gate?.context ?? getLabInfluenceContext(state)
  const entry = ensureLabFrontierRouteCache(state)[getLabFrontierRouteCacheKey(state, x, y, context, gate?.cacheScope ?? "")]
  if (!entry || typeof entry.dir !== "string" || !labDirections[entry.dir]) return null
  if (options?.allowBackStart !== true && backDir && entry.dir === backDir) return null
  if (entry.targetKey && state?.rooms?.[entry.targetKey]?.explored === true) return null
  if (isLabDeadMovePrefilterBlocked(state, x, y, entry.dir, gate, context)) return null
  const gateResult = gate?.check ? gate.check(x, y, entry.dir, { ignoreSkip: entry.dir === backDir }) : null
  if (!gateResult?.allowed) return null
  const delta = labDirections[entry.dir]
  return {
    x: x + delta.dx,
    y: y + delta.dy,
    dir: entry.dir,
    backstep: Boolean(backDir && entry.dir === backDir),
    exitFocusRank: entry.exitFocusRank ?? 0,
    targetExitFocusRank: entry.targetExitFocusRank ?? 0
  }
}
function setLabFrontierRouteCacheEntry(state, x, y, entry, context = getLabInfluenceContext(state), cacheScope = "") {
  if (!state || !Number.isInteger(x) || !Number.isInteger(y) || !entry || !labDirections[entry.dir]) return false
  const key = getLabFrontierRouteCacheKey(state, x, y, context, cacheScope)
  const cache = ensureLabFrontierRouteCache(state)
  const existing = cache[key]
  const next = {
    dir: entry.dir,
    targetKey: typeof entry.targetKey === "string" ? entry.targetKey : "",
    distance: Number.isFinite(entry.distance) ? entry.distance : Number.POSITIVE_INFINITY,
    goalRank: Number.isFinite(entry.goalRank) ? entry.goalRank : Number.POSITIVE_INFINITY,
    targetGoalRank: Number.isFinite(entry.targetGoalRank) ? entry.targetGoalRank : Number.POSITIVE_INFINITY,
    exitFocusRank: Number.isFinite(entry.exitFocusRank) ? entry.exitFocusRank : 0,
    targetExitFocusRank: Number.isFinite(entry.targetExitFocusRank) ? entry.targetExitFocusRank : 0,
    dirIndex: labDirectionIndex[entry.dir] ?? 99
  }
  const existingStale = Boolean(existing?.targetKey && state.rooms?.[existing.targetKey]?.explored === true)
  if (!existing || existingStale
    || next.exitFocusRank < (existing.exitFocusRank ?? 0)
    || (next.exitFocusRank === (existing.exitFocusRank ?? 0) && next.targetExitFocusRank < (existing.targetExitFocusRank ?? 0))
    || (next.exitFocusRank === (existing.exitFocusRank ?? 0) && next.targetExitFocusRank === (existing.targetExitFocusRank ?? 0) && next.distance < (existing.distance ?? Number.POSITIVE_INFINITY))
    || (next.exitFocusRank === (existing.exitFocusRank ?? 0) && next.targetExitFocusRank === (existing.targetExitFocusRank ?? 0) && next.distance === (existing.distance ?? Number.POSITIVE_INFINITY) && next.goalRank < (existing.goalRank ?? Number.POSITIVE_INFINITY))
    || (next.exitFocusRank === (existing.exitFocusRank ?? 0) && next.targetExitFocusRank === (existing.targetExitFocusRank ?? 0) && next.distance === (existing.distance ?? Number.POSITIVE_INFINITY) && next.goalRank === (existing.goalRank ?? Number.POSITIVE_INFINITY) && next.targetGoalRank < (existing.targetGoalRank ?? Number.POSITIVE_INFINITY))
    || (next.exitFocusRank === (existing.exitFocusRank ?? 0) && next.targetExitFocusRank === (existing.targetExitFocusRank ?? 0) && next.distance === (existing.distance ?? Number.POSITIVE_INFINITY) && next.goalRank === (existing.goalRank ?? Number.POSITIVE_INFINITY) && next.targetGoalRank === (existing.targetGoalRank ?? Number.POSITIVE_INFINITY) && next.dirIndex < (existing.dirIndex ?? 99))) {
    cache[key] = next
    return true
  }
  return false
}
function backfillLabFrontierRouteCache(state, best, nodeByKey, context = getLabInfluenceContext(state), cacheScope = "") {
  if (!state || !best?.sourceKey || !best.targetKey || !(nodeByKey instanceof Map)) return false
  const nodes = []
  let cursor = nodeByKey.get(best.sourceKey)
  while (cursor) {
    nodes.push(cursor)
    if (!cursor.parentKey) break
    cursor = nodeByKey.get(cursor.parentKey)
  }
  nodes.reverse()
  if (nodes.length === 0) return false
  let changed = false
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const nextNode = nodes[i + 1]
    const dir = nextNode ? getLabDirectionBetween(node.x, node.y, nextNode.x, nextNode.y) : getLabDirectionBetween(node.x, node.y, best.targetX, best.targetY)
    if (!dir) continue
    if (setLabFrontierRouteCacheEntry(state, node.x, node.y, {
      dir,
      targetKey: best.targetKey,
      distance: Math.max(1, best.distance - node.distance),
      goalRank: best.goalRank,
      targetGoalRank: best.targetGoalRank,
      exitFocusRank: Math.max(node.pathExitFocusRank ?? 0, best.targetExitFocusRank ?? 0),
      targetExitFocusRank: best.targetExitFocusRank
    }, context, cacheScope)) changed = true
  }
  return changed
}
function pickLabRouteToFrontier(state, workerId, x, y, skipKeys, backDir, gate = createLabMoveGate(state, { skipKeys, workerId, currentX: x, currentY: y }), eligibleStartMoves = null, options = {}) {
  const startRoom = state?.rooms?.[getLabKey(x, y)]
  if (!startRoom?.explored || !startRoom.exits) return null
  const layout = state.layout
  const context = gate.context
  const cached = getCachedLabFrontierRoute(state, x, y, gate, backDir, options)
  if (cached) return cached
  const startGoalDirs = context ? getLabImmediateGoalwardDirs(state, x, y, context) : []
  const startInExitQuadrant = Boolean(context && isLabInExitQuadrant(x, y, context))
  const allowBackStart = options?.allowBackStart === true
  const startKey = getLabKey(x, y)
  const visited = new Set([startKey])
  const nodeByKey = new Map([[startKey, { key: startKey, x, y, distance: 0, parentKey: "", dirFromParent: "", pathExitFocusRank: 0 }]])
  const queue = []
  const addRouteNode = (dir, nx, ny, distance, firstDirGoalRank = null, pathExitFocusRank = 0, parentKey = startKey, dirFromParent = dir) => {
    const key = getLabKey(nx, ny)
    if (visited.has(key)) return
    const nextRoom = state.rooms?.[key]
    if (!nextRoom?.explored) return
    visited.add(key)
    const node = {
      key,
      x: nx,
      y: ny,
      firstDir: dir,
      distance,
      firstDirGoalRank: Number.isFinite(firstDirGoalRank) ? firstDirGoalRank : getLabGoalDirRank(dir, startGoalDirs),
      firstDirIndex: labDirectionIndex[dir] ?? 99,
      pathExitFocusRank: Number.isFinite(pathExitFocusRank) ? pathExitFocusRank : 0,
      parentKey,
      dirFromParent
    }
    nodeByKey.set(key, node)
    queue.push(node)
  }
  const startEdges = []
  const startMoves = Array.isArray(eligibleStartMoves) ? eligibleStartMoves : null
  if (startMoves) {
    for (const move of startMoves) {
      if (!move || (!allowBackStart && move.isBack)) continue
      const nextRoom = state.rooms?.[getLabKey(move.x, move.y)]
      if (!nextRoom?.explored) continue
      startEdges.push({
        dir: move.dir,
        x: move.x,
        y: move.y,
        goalRank: getLabMoveGoalRank(move, startGoalDirs),
        exitFocusRank: move.exitFocusRank ?? 0,
        backRank: backDir && move.dir === backDir ? 1 : 0,
        dirIndex: move.dirIndex
      })
    }
  }
  if (!startMoves) for (const [dir, delta] of labDirectionEntries) {
    if (startRoom.exits?.[dir] !== true) continue
    const nx = x + delta.dx
    const ny = y + delta.dy
    if (layout && (nx < layout.minX || nx > layout.maxX || ny < layout.minY || ny > layout.maxY)) continue
    if (isLabDeadMovePrefilterBlocked(state, x, y, dir, gate, context)) continue
    const gateResult = gate.check(x, y, dir)
    if (!gateResult.allowed) continue
    const nextRoom = state.rooms?.[getLabKey(nx, ny)]
    if (!nextRoom?.explored) continue
    startEdges.push({
      dir,
      x: nx,
      y: ny,
      goalRank: gateResult.gateway ? -1 : getLabGoalDirRank(dir, startGoalDirs),
      exitFocusRank: getLabExitFocusMoveRank(state, x, y, nx, ny, context),
      backRank: backDir && dir === backDir ? 1 : 0,
      dirIndex: labDirectionIndex[dir] ?? 99
    })
  }
  startEdges.sort((a, b) => a.exitFocusRank - b.exitFocusRank || a.goalRank - b.goalRank || a.backRank - b.backRank || a.dirIndex - b.dirIndex)
  for (const edge of startEdges) addRouteNode(edge.dir, edge.x, edge.y, 1, edge.goalRank, edge.exitFocusRank)

  let best = null
  let head = 0
  while (head < queue.length) {
    const node = queue[head++]
    const nodeRoom = state.rooms?.[getLabKey(node.x, node.y)]
    if (!nodeRoom?.explored || !nodeRoom.exits) continue
    const nodeGoalDirs = context ? getLabImmediateGoalwardDirs(state, node.x, node.y, context) : []
    const edges = []
    for (const move of getLabEligibleMovesForRoom(state, node.x, node.y, gate)) {
      const key = getLabKey(move.x, move.y)
      edges.push({
        dir: move.dir,
        x: move.x,
        y: move.y,
        key,
        goalRank: getLabMoveGoalRank(move, nodeGoalDirs),
        exitFocusRank: move.exitFocusRank ?? 0,
        dirIndex: move.dirIndex
      })
    }
    edges.sort((a, b) => a.exitFocusRank - b.exitFocusRank || a.goalRank - b.goalRank || a.dirIndex - b.dirIndex)
    for (const edge of edges) {
      const nextRoom = state.rooms?.[edge.key]
      if (!nextRoom?.explored) {
        const firstDelta = labDirections[node.firstDir]
        if (!firstDelta) continue
        const pathExitFocusRank = Math.max(node.pathExitFocusRank ?? 0, edge.exitFocusRank ?? 0)
        const candidate = {
          x: x + firstDelta.dx,
          y: y + firstDelta.dy,
          dir: node.firstDir,
          sourceKey: getLabKey(node.x, node.y),
          targetKey: edge.key,
          targetX: edge.x,
          targetY: edge.y,
          distance: node.distance + 1,
          goalRank: node.firstDirGoalRank,
          exitFocusRank: pathExitFocusRank,
          targetExitFocusRank: startInExitQuadrant ? getLabExitFocusPointRank(state, edge.x, edge.y, context) : 0,
          targetGoalRank: edge.goalRank,
          dirIndex: node.firstDirIndex
        }
        if (!best
          || candidate.exitFocusRank < best.exitFocusRank
          || (candidate.exitFocusRank === best.exitFocusRank && candidate.targetExitFocusRank < best.targetExitFocusRank)
          || (candidate.exitFocusRank === best.exitFocusRank && candidate.targetExitFocusRank === best.targetExitFocusRank && candidate.distance < best.distance)
          || (candidate.exitFocusRank === best.exitFocusRank && candidate.targetExitFocusRank === best.targetExitFocusRank && candidate.distance === best.distance && candidate.goalRank < best.goalRank)
          || (candidate.exitFocusRank === best.exitFocusRank && candidate.targetExitFocusRank === best.targetExitFocusRank && candidate.distance === best.distance && candidate.goalRank === best.goalRank && candidate.targetGoalRank < best.targetGoalRank)
          || (candidate.exitFocusRank === best.exitFocusRank && candidate.targetExitFocusRank === best.targetExitFocusRank && candidate.distance === best.distance && candidate.goalRank === best.goalRank && candidate.targetGoalRank === best.targetGoalRank && candidate.dirIndex < best.dirIndex)) {
          best = candidate
        }
        continue
      }
      if (!visited.has(edge.key)) {
        visited.add(edge.key)
        const nextNode = {
          key: edge.key,
          x: edge.x,
          y: edge.y,
          firstDir: node.firstDir,
          distance: node.distance + 1,
          firstDirGoalRank: node.firstDirGoalRank,
          firstDirIndex: node.firstDirIndex,
          pathExitFocusRank: Math.max(node.pathExitFocusRank ?? 0, edge.exitFocusRank ?? 0),
          parentKey: node.key,
          dirFromParent: edge.dir
        }
        nodeByKey.set(edge.key, nextNode)
        queue.push(nextNode)
      }
    }
  }
  if (!best) return null
  backfillLabFrontierRouteCache(state, best, nodeByKey, context, gate?.cacheScope ?? "")
  return {
    x: best.x,
    y: best.y,
    dir: best.dir,
    backstep: Boolean(backDir && best.dir === backDir),
    exitFocusRank: best.exitFocusRank,
    targetExitFocusRank: best.targetExitFocusRank
  }
}
function pickGreedyStep(state, workerId, x, y, options = {}) {
  const room = state?.rooms?.[getLabKey(x, y)]
  if (!room?.explored || !room.exits) return null
  const skipKeys = getLabPickSkipSet(options)
  const context = getLabInfluenceContext(state)
  prepareLabDeadRoomMoveFilter(state, x, y, context)
  const inExitQuadrant = Boolean(context && isLabInExitQuadrant(x, y, context))
  const inExitSubquadrant = Boolean(context && isLabInExitSubquadrant(x, y, context))
  const gate = createLabMoveGate(state, { skipKeys, context, workerId, currentX: x, currentY: y })
  const roomPath = Array.isArray(room.path) ? room.path : []
  const lastForwardDir = peekLabWorkerVisit(workerId) || roomPath[roomPath.length - 1] || ""
  const backDir = labDirections[lastForwardDir]?.back ?? ""
  const rawEligibleMoves = getLabEligibleMovesForRoom(state, x, y, gate, { backDir })
  const emergencyEscape = rawEligibleMoves.length === 0 && gate.isDeadRoom(x, y) === true
    ? getLabEmergencyDeadEscapeMove(state, x, y, backDir, context)
    : null
  if (emergencyEscape) return emergencyEscape
  // Forced dead-end escape. If the worker is already inside a marked
  // dead area, leave before considering any picker bucket. This prevents
  // exit-zone workers from spending extra decisions in a known dead room.
  const escape = gate.getEscape(x, y)
  if (escape && room.exits[escape] === true) {
    const escapeMove = rawEligibleMoves.find((move) => move.dir === escape)
    if (escapeMove) {
      const lastPushed = peekLabWorkerVisit(workerId)
      const isBackstep = lastPushed && labDirections[lastPushed]?.back === escape
      return { x: escapeMove.x, y: escapeMove.y, dir: escape, backstep: !!isBackstep }
    }
  }
  const eligibleMoves = addLabPotentialMoveCosts(state, rawEligibleMoves, gate, { originX: x, originY: y })
  const forwardMoves = eligibleMoves.filter((move) => !move.isBack)
  const hasForwardMove = forwardMoves.length > 0
  const goalDirs = context ? getLabImmediateGoalwardDirs(state, x, y, context) : []
  if (inExitSubquadrant) {
    const exitInsideForwardPick = pickLabExitSubquadrantForwardMove(eligibleMoves, goalDirs, context, { stayInExitSubquadrant: true })
    if (exitInsideForwardPick) return exitInsideForwardPick
    const exitInsideRoute = pickLabRouteToFrontier(state, workerId, x, y, skipKeys, backDir, gate, eligibleMoves, { allowBackStart: !hasForwardMove })
    if (exitInsideRoute && exitInsideRoute.targetExitFocusRank === 0) return exitInsideRoute
    const exitForwardPick = pickLabExitSubquadrantForwardMove(eligibleMoves, goalDirs, context)
    if (exitForwardPick) return exitForwardPick
  } else if (inExitQuadrant) {
    const exitReturnRoute = pickLabRouteToFrontier(state, workerId, x, y, skipKeys, backDir, gate, eligibleMoves, { allowBackStart: !hasForwardMove })
    if (exitReturnRoute && exitReturnRoute.targetExitFocusRank === 0) return exitReturnRoute
  }
  if (context && isLabInExitSubquadrant(x, y, context) && goalDirs.length > 0) {
    const exitTargetMoves = eligibleMoves.filter((move) => goalDirs.includes(move.dir))
    const unexploredExitTargetMoves = exitTargetMoves.filter((move) => !move.explored)
    const exitTargetPick = unexploredExitTargetMoves.length > 0
      ? pickFirstLabCandidate(unexploredExitTargetMoves)
      : pickFirstLabExploredCostCandidate(exitTargetMoves)
    if (exitTargetPick) return exitTargetPick
  }
  if (eligibleMoves.length > 0 && eligibleMoves.every((move) => move.explored)) {
    const exploredRoute = pickLabRouteToFrontier(state, workerId, x, y, skipKeys, backDir, gate, eligibleMoves)
    if (exploredRoute) return exploredRoute
    const liveExploredMoves = eligibleMoves.filter((move) => !hasForwardMove || !move.isBack)
    const exploredPick = pickFirstLabExploredCostCandidate(liveExploredMoves)
    if (exploredPick) return exploredPick
    const exploredForwardPick = pickFirstLabAllowedForwardCandidate(eligibleMoves)
    if (exploredForwardPick) return exploredForwardPick
  }
  const unexploredGatewayForward = []
  const unexploredGoalForward = []
  const unexploredSideForward = []
  let backCandidate = null
  for (const candidate of eligibleMoves) {
    // Candidate was already filtered by getLabEligibleMovesForRoom.
    if (candidate.isBack) { backCandidate = candidate; continue }
    if (candidate.explored) continue
    if (candidate.gateway && (candidate.exitFocusRank ?? 0) < 3) unexploredGatewayForward.push(candidate)
    else if (goalDirs.includes(candidate.dir)) unexploredGoalForward.push(candidate)
    else unexploredSideForward.push(candidate)
  }
  // Deterministic ordering happens inside each priority bucket.  Cost is
  // only considered when two candidates in that same bucket are unexplored.
  const immediateGateway = pickFirstLabCandidate(unexploredGatewayForward)
  if (immediateGateway) return immediateGateway
  const immediateGoal = pickFirstLabGoalCandidate(unexploredGoalForward, goalDirs)
  if (immediateGoal) return immediateGoal
  const immediateSide = pickFirstLabCandidate(unexploredSideForward)
  if (immediateSide) return immediateSide
  const routed = pickLabRouteToFrontier(state, workerId, x, y, skipKeys, backDir, gate, eligibleMoves)
  if (routed) return routed
  const forwardFallback = pickFirstLabAllowedForwardCandidate(eligibleMoves)
  if (forwardFallback) return forwardFallback
  if (backCandidate) {
    return { x: backCandidate.x, y: backCandidate.y, dir: backCandidate.dir, backstep: true }
  }
  return null
}

// ----- Walk one step --------------------------------------------------------
// Sends `dir` to the labHunter, parses the auth result, updates worker
// position, maintains the visit stack, records the destination room when
// it carries new exit information.
function getLabExitCoordsFromStep(state, currentX, currentY, dir, result) {
  const authResult = result?.authResults ?? result
  const rawCoords = getLabRawCoordsFromAuthResult(authResult)
  if (Array.isArray(rawCoords)) {
    const [actualX, actualY] = getLabActualCoords(rawCoords[0], rawCoords[1], { coords: rawCoords }, state)
    if (Number.isInteger(actualX) && Number.isInteger(actualY)) return [actualX, actualY]
  }
  const delta = labDirections[dir]
  if (delta && Number.isInteger(currentX) && Number.isInteger(currentY)) {
    return [currentX + delta.dx, currentY + delta.dy]
  }
  return [null, null]
}
function recordLabFinishCell(state, finishX, finishY, workerId = "") {
  if (!state?.layout || !Number.isInteger(finishX) || !Number.isInteger(finishY)) return false
  if (Number.isInteger(state.layout.finishX) && Number.isInteger(state.layout.finishY)) {
    return state.layout.finishX === finishX && state.layout.finishY === finishY
  }
  let extended = false
  if (finishX > state.layout.maxX) { state.layout.maxX = finishX; extended = true }
  if (finishY > state.layout.maxY) { state.layout.maxY = finishY; extended = true }
  if (finishX < state.layout.minX) { state.layout.minX = finishX; extended = true }
  if (finishY < state.layout.minY) { state.layout.minY = finishY; extended = true }
  state.layout.finishX = finishX
  state.layout.finishY = finishY
  state.layout.goalX = finishX
  state.layout.goalY = finishY
  state.finishKey = getLabKey(finishX, finishY)
  if (workerId) state.finishWorkerId = workerId
  markLabDisplayDirtyCoords(state, finishX, finishY)
  pruneLabProtectedDeadMarks(state)
  if (extended) syncLabDisplayMap(state, true)
  state.displayVersion = (state.displayVersion ?? 0) + 1
  state.displayOutputKey = ""
  return true
}
async function walkOneStep(ns, server, details, workerId, labWorker, dir, currentX, currentY) {
  const state = labState
  const context = getLabInfluenceContext(state)
  prepareLabDeadRoomMoveFilter(state, currentX, currentY, context)
  const moveGate = createLabMoveGate(state, { context, workerId, currentX, currentY })
  if (isLabDeadMovePrefilterBlocked(state, currentX, currentY, dir, moveGate, context)) {
    syncLabToInProgress(server)
    return { blocked: true, deadEndBlocked: true, currentX, currentY }
  }
  const gateResult = moveGate.check(currentX, currentY, dir)
  if (!gateResult.allowed) {
    syncLabToInProgress(server)
    return { blocked: true, deadEndBlocked: gateResult.reason === "dead", currentX, currentY }
  }
  const result = await labWork(ns, labWorker, dir)
  if (result?.workerExited) return { workerExited: true }
  const resultReport = result?.report || false
  if (!resultReport && result?.authResults?.success === false && details && !serverCheck(ns, server, details, result.authResults)) {
    return { lostServer: true, currentX, currentY }
  }
  if (result?.finished && !resultReport) {
    // Record the exit cell on the live state so the display draws the
    // X marker.  Coords come from the auth result's "You have moved to
    // X, Y." message; we translate via the same coord-offset frame as
    // every other room.  If the exit lies past the layout's bounding
    // rectangle (it always does — the exit is one step beyond the
    // outermost row of rooms), extend the bounds and rebuild the
    // display map so the cell is actually inside the rendered board.
    const resultDir = typeof result.dir === "string" && labDirections[result.dir] ? result.dir : dir
    const [exitX, exitY] = getLabExitCoordsFromStep(state, currentX, currentY, resultDir, result)
    recordLabFinishCell(state, exitX, exitY, workerId)
    syncLabToInProgress(server)
    const finalExitX = Number.isInteger(state?.layout?.finishX) ? state.layout.finishX : exitX
    const finalExitY = Number.isInteger(state?.layout?.finishY) ? state.layout.finishY : exitY
    return { finished: true, authResults: result.authResults, exitX: finalExitX, exitY: finalExitY }
  }
  const report = resultReport
  if (!report) return { blocked: true, currentX, currentY }
  const delta = labDirections[dir]
  const expectedX = delta ? currentX + delta.dx : currentX
  const expectedY = delta ? currentY + delta.dy : currentY
  const moveCoords = getLabMoveCoords(currentX, currentY, expectedX, expectedY, report, state)
  if (moveCoords.status === "blocked") {
    const currentPath = state.rooms?.[getLabKey(currentX, currentY)]?.path ?? []
    recordLabRoom(state, currentX, currentY, report, currentPath, true)
    syncLabToInProgress(server)
    return { blocked: true, currentX, currentY }
  }
  if (moveCoords.status === "mismatch") {
    const actual = state.rooms?.[getLabKey(moveCoords.reportedX, moveCoords.reportedY)]
    recordLabRoom(state, moveCoords.reportedX, moveCoords.reportedY, report, actual?.path ?? [], true)
    setLabWorkerPosition(state, workerId, moveCoords.reportedX, moveCoords.reportedY)
    syncLabToInProgress(server)
    return { desynced: true, currentX: moveCoords.reportedX, currentY: moveCoords.reportedY }
  }
  const newX = moveCoords.x
  const newY = moveCoords.y
  rememberLabWorkerQuadrantCommit(state, workerId, currentX, currentY, newX, newY, context)
  setLabWorkerPosition(state, workerId, newX, newY)
  // Visit-stack maintenance: if this dir undoes the last push, pop;
  // otherwise push.  Auto-detection means callers don't have to declare
  // intent and the stack stays consistent.
  const lastPushedDir = peekLabWorkerVisit(workerId)
  if (lastPushedDir && labDirections[lastPushedDir]?.back === dir) popLabWorkerVisit(workerId)
  else pushLabWorkerVisit(workerId, dir)
  // Only pay the recordLabRoom cost when the destination has new info.
  const destRoom = state.rooms?.[getLabKey(newX, newY)]
  if (!destRoom?.jsonLog) {
    const sourcePath = state.rooms?.[getLabKey(currentX, currentY)]?.path ?? []
    recordLabRoom(state, newX, newY, report, sourcePath.concat(dir))
  }
  syncLabToInProgress(server)
  return { moved: true, currentX: newX, currentY: newY, quadrantCrossed: Boolean(gateResult.crossing) }
}

// ----- Display app — labmap (stays external to the case body) --------------
function getReactLib() {
  return globalThis["React"] ?? globalThis["window"]?.React
}
const labCanvasUnknownPresentation = { fill: "#082536", stroke: "#0e7490", alpha: 0.55, label: "", labelColor: "#67e8f9" }
const labCanvasFillPresentation = { fill: "#030712", stroke: "#111827", alpha: 1, label: "", labelColor: "#020617" }
const labCanvasOpenPresentation = { fill: "#147044", stroke: "#34d399", alpha: 1, label: "", labelColor: "#bbf7d0", glow: "#34d399" }
const labCanvasStartPresentation = { fill: "#86efac", stroke: "#f0fdf4", alpha: 1, label: "S", labelColor: "#022c22" }
const labCanvasFinishPresentation = { fill: "#ef4444", stroke: "#fecaca", alpha: 1, label: "X", labelColor: "#450a0a" }
const labCanvasWorkerPresentation = { fill: "#06b6d4", stroke: "#cffafe", alpha: 1, label: "o", labelColor: "#042f2e" }
function getLabCanvasCellPresentation(char) {
  if (char === "·" || char === labMapPossibleHall || char === labMapUnknownRoom) {
    return labCanvasUnknownPresentation
  }
  switch (char) {
    case labMapFill: return labCanvasFillPresentation
    case labMapOpen: return labCanvasOpenPresentation
    case labMapStart: return labCanvasStartPresentation
    case labMapFinish: return labCanvasFinishPresentation
    case labMapWorker: return labCanvasWorkerPresentation
    default: return { fill: "#111827", stroke: "#1f2937", alpha: 1, label: (char ?? "").trim(), labelColor: "#64748b" }
  }
}
/** @param {NS} ns */
function autoSizeLabTail(ns, map) {
  const { cols, rows } = getLabMapDimensions(map)
  const width = Math.max(360, 46 + (cols * (cellSize + cellGap)))
  const height = Math.max(268, 162 + (rows * (cellSize + cellGap)))
  if (ns.self().tailProperties.height !== height || ns.self().tailProperties.width !== width)
    ns.ui.resizeTail(width, height)
}
function drawLabMapCanvas(canvas, map, options = {}) {
  if (!canvas || !Array.isArray(map)) return
  const { cols, rows } = getLabMapDimensions(map)
  const previousMap = Array.isArray(options.previousMap) ? options.previousMap : null
  const previousDimensions = getLabMapDimensions(previousMap ?? [])
  const previousCols = previousDimensions.cols
  const previousRows = previousDimensions.rows
  const firstDraw = canvas._labHasDrawn !== true
  const pixelRatio = firstDraw
    ? Math.max(1, Math.min(2, globalThis?.devicePixelRatio ?? 1))
    : (canvas._labPixelRatio ?? Math.max(1, Math.min(2, globalThis?.devicePixelRatio ?? 1)))
  const width = Math.max(1, cols * cellSize + Math.max(0, cols - 1) * cellGap)
  const height = Math.max(1, rows * cellSize + Math.max(0, rows - 1) * cellGap)
  const canvasWidth = Math.ceil(width * pixelRatio)
  const canvasHeight = Math.ceil(height * pixelRatio)
  if (firstDraw) {
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight
    if (canvas.style.width !== `${width}px`) canvas.style.width = `${width}px`
    if (canvas.style.height !== `${height}px`) canvas.style.height = `${height}px`
  }
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  const fullRedraw = firstDraw
  const background = "#020617"
  if (fullRedraw) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.font = `700 ${Math.max(8, cellSize - 4)}px monospace`
  let curFill = "", curStroke = "", curAlpha = 1, curBlur = 0, curShadowColor = ""
  let lineWidthSet = false
  const setFill = (v) => { if (curFill !== v) { ctx.fillStyle = v; curFill = v } }
  const setStroke = (v) => { if (curStroke !== v) { ctx.strokeStyle = v; curStroke = v } }
  const setAlpha = (v) => { if (curAlpha !== v) { ctx.globalAlpha = v; curAlpha = v } }
  const setBlur = (v) => { if (curBlur !== v) { ctx.shadowBlur = v; curBlur = v } }
  const setShadowColor = (v) => { if (curShadowColor !== v) { ctx.shadowColor = v; curShadowColor = v } }
  const strokeInset = 0.5
  const strokeSize = Math.max(1, cellSize - 1)
  const halfCell = cellSize / 2
  const stride = cellSize + cellGap
  const drawCell = (x, y, char, needsClear) => {
    const cell = getLabCanvasCellPresentation(char)
    const px = x * stride
    const py = y * stride
    const cellAlpha = cell.alpha ?? 1
    if (needsClear) {
      setBlur(0); setAlpha(1); setFill(background)
      ctx.fillRect(px, py, Math.min(stride, width - px), Math.min(stride, height - py))
    }
    setAlpha(cellAlpha)
    if (cell.glow) { setShadowColor(cell.glow); setBlur(cellSize * 0.35) }
    else setBlur(0)
    setFill(cell.fill)
    ctx.fillRect(px, py, cellSize, cellSize)
    if (cell.glow) setBlur(0)
    setAlpha(Math.min(1, cellAlpha + 0.2))
    setStroke(cell.stroke)
    if (!lineWidthSet) { ctx.lineWidth = 1; lineWidthSet = true }
    ctx.strokeRect(px + strokeInset, py + strokeInset, strokeSize, strokeSize)
    if (cell.label) {
      setAlpha(1); setFill(cell.labelColor)
      ctx.fillText(cell.label, px + halfCell, py + halfCell + 0.5)
    }
  }
  if (fullRedraw) {
    for (let y = 0; y < rows; y++) {
      const row = typeof map[y] === "string" ? map[y] : ""
      for (let x = 0; x < cols; x++) drawCell(x, y, row[x] ?? labMapFill, false)
    }
    canvas._labHasDrawn = true
    canvas._labPixelRatio = pixelRatio
    setAlpha(1); setBlur(0)
    return
  }
  // Incremental dirty-rect path.  Reuse the dirty bitmap across frames via
  // canvas._labDirty; per-frame work bounded by changed cells, not grid size.
  let dirty = canvas._labDirty
  const total = cols * rows
  if (!(dirty instanceof Uint8Array) || dirty.length !== total) {
    dirty = new Uint8Array(total)
    canvas._labDirty = dirty
  }
  let dirtyList = canvas._labDirtyList
  if (!Array.isArray(dirtyList)) { dirtyList = []; canvas._labDirtyList = dirtyList }
  for (let i = 0; i < dirtyList.length; i++) dirty[dirtyList[i]] = 0
  dirtyList.length = 0
  const markDirty = (x, y) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return
    const idx = y * cols + x
    if (dirty[idx] === 0) { dirty[idx] = 1; dirtyList.push(idx) }
  }
  const fillCharCode = labMapFill.charCodeAt(0)
  const openCharCode = labMapOpen.charCodeAt(0)
  if (!previousMap || previousMap.length === 0) {
    canvas._labHasDrawn = true
    canvas._labPixelRatio = pixelRatio
    setAlpha(1); setBlur(0)
    return
  }
  const markChangedCell = (x, y) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return
    const row = typeof map[y] === "string" ? map[y] : ""
    const previousRow = typeof previousMap?.[y] === "string" ? previousMap[y] : ""
    const newCode = x < row.length ? row.charCodeAt(x) : fillCharCode
    const oldCode = x < previousRow.length ? previousRow.charCodeAt(x) : fillCharCode
    if (newCode === oldCode) return
    const involvesGlow = newCode === openCharCode || oldCode === openCharCode
    if (involvesGlow) {
      markDirty(x - 1, y - 1); markDirty(x, y - 1); markDirty(x + 1, y - 1)
      markDirty(x - 1, y); markDirty(x, y); markDirty(x + 1, y)
      markDirty(x - 1, y + 1); markDirty(x, y + 1); markDirty(x + 1, y + 1)
    } else {
      markDirty(x, y)
    }
  }
  const suppliedDirtyCells = Array.isArray(options.dirtyCells) ? options.dirtyCells : []
  for (const cell of suppliedDirtyCells) {
    if (!Array.isArray(cell) || cell.length < 2) continue
    markChangedCell(cell[0], cell[1])
  }
  for (let i = 0; i < dirtyList.length; i++) {
    const idx = dirtyList[i]
    const y = (idx / cols) | 0
    const x = idx - y * cols
    const row = typeof map[y] === "string" ? map[y] : ""
    const newCode = x < row.length ? row.charCodeAt(x) : fillCharCode
    const newChar = String.fromCharCode(newCode)
    const newlyExposed = x >= previousCols || y >= previousRows
    let needsClear = newlyExposed || (newCode !== fillCharCode && (getLabCanvasCellPresentation(newChar).alpha ?? 1) < 1)
    if (!needsClear) {
      for (let dy = -1; dy <= 1 && !needsClear; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= rows) continue
        const prevRow = typeof previousMap?.[ny] === "string" ? previousMap[ny] : ""
        if (prevRow.length === 0) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= prevRow.length) continue
          if (prevRow.charCodeAt(nx) === openCharCode) { needsClear = true; break }
        }
      }
    }
    drawCell(x, y, newChar, needsClear)
  }
  canvas._labHasDrawn = true
  canvas._labPixelRatio = pixelRatio
  setAlpha(1); setBlur(0)
}
function startMapDisplay(ns, options = {}) {
  const React = getReactLib()
  ns.ui.openTail()
  logOpened = true
  if (!React) return
  ns.clearLog()
  ns.printRaw(React.createElement(LabMapApp, { ns, options }))
}
function LabMapApp({ ns }) {
  const React = getReactLib()
  if (!React) return null
  const e = React.createElement
  const canvasRef = React.useRef(null)
  const lastDrawnMapRef = React.useRef([])
  const lastSizeKeyRef = React.useRef("")
  const [snapshot, setSnapshot] = React.useState({ map: [], versionKey: "", hasData: false, fullRedraw: true, dirtyCells: null })
  React.useEffect(() => {
    let cancelled = false
    let timer = 0
    let lastVersionKey = null
    let lastNonEmptyMap = []
    const tick = () => {
      const sourceKey = getLabMapSourceKey(labState)
      if (!cancelled && sourceKey !== lastVersionKey) {
        const rows = labState ? buildLabMapObject(labState) : []
        const versionKey = labState?.displayOutputKey || sourceKey
        let nextMap = rows.length > 0 ? rows : lastNonEmptyMap
        if (rows.length > 0) lastNonEmptyMap = rows
        lastVersionKey = sourceKey
        if (nextMap.length > 0 && !lastSizeKeyRef.current) {
          const { cols, rows: rowCount } = getLabMapDimensions(nextMap)
          const sizeKey = `${cols}x${rowCount}`
          lastSizeKeyRef.current = sizeKey
          autoSizeLabTail(ns, nextMap)
        }
        const fullRedraw = lastDrawnMapRef.current.length === 0
        setSnapshot({ map: nextMap, versionKey, hasData: nextMap.length > 0, fullRedraw, dirtyCells: labState?.displayOutputDirtyCells ?? null })
      }
      if (!cancelled && modeShowMap) timer = setTimeout(tick, refreshMs)
    }
    tick()
    return () => { cancelled = true; if (timer) clearTimeout(timer) }
  }, [ns])
  React.useEffect(() => {
    if (!snapshot.hasData) return
    drawLabMapCanvas(canvasRef.current, snapshot.map, {
      previousMap: lastDrawnMapRef.current,
      fullRedraw: snapshot.fullRedraw,
      dirtyCells: snapshot.dirtyCells
    })
    lastDrawnMapRef.current = snapshot.map
  }, [snapshot.versionKey, snapshot.hasData, snapshot.fullRedraw, snapshot.dirtyCells])
  const containerStyle = {
    padding: "14px",
    background: "linear-gradient(135deg, rgba(2, 6, 23, 0.98), rgba(8, 13, 34, 0.98))",
    color: "#f8fafc",
    fontFamily: "monospace",
    minHeight: "100%"
  }
  const headerStyle = { color: "#22d3ee", fontSize: "12px", marginBottom: "10px" }
  return e("div", { style: containerStyle },
    e("div", { style: headerStyle }, labState?.serverName ?? "labTest"),
    e("canvas", { ref: canvasRef })
  )
}
let labCompleteAnswer = ""
let labCompleteMap = null
let labCompleteServerName = ""

// ---------------------------------------------------------------------------
// State lookup.  In the old solver this returned a per-server entry from
// the inProgress Map (creating one if missing).  Here we have a single
// labState; redirect to ensureLabState which creates / returns it.
// ---------------------------------------------------------------------------
function getLabState(server, details) {
  const state = ensureLabState(server)
  if (details && !state.details) state.details = details
  return state
}

// ---------------------------------------------------------------------------
// Root room lookup — returns the start cell for `server` if labState is
// bound to that server and a rootKey has been pinned, else null.
// ---------------------------------------------------------------------------
function getLabRootRoom(server) {
  if (!labState || labState.serverName !== server) return null
  if (typeof labState.rootKey !== "string" || !labState.rootKey) return null
  return labState.rooms?.[labState.rootKey] ?? null
}

// ---------------------------------------------------------------------------
// Single-room and worker-position accessors.  The old solver's APIs took
// a server name; we just check it matches the bound state and read from
// labState.
// ---------------------------------------------------------------------------
function getLabRoom(server, x, y) {
  if (!labState || labState.serverName !== server) return null
  return labState.rooms?.[getLabKey(x, y)] ?? null
}
function getLabRoomReport(server, x, y) {
  return getLabRoom(server, x, y)?.jsonLog ?? false
}
function getLabWorkerPosition(server, workerId) {
  if (!labState || labState.serverName !== server) return null
  const worker = labState.workers?.[workerId]
  if (!worker) return null
  return [worker.x, worker.y]
}
function updateLabWorkerPosition(server, details, workerId, x, y) {
  const state = getLabState(server, details)
  setLabWorkerPosition(state, workerId, x, y)
}
function clearLabWorkerPosition(server, workerId) {
  if (!labState || labState.serverName !== server) return
  if (labState.workers?.[workerId]) {
    markLabDisplayDirtyCoords(labState, labState.workers[workerId].x, labState.workers[workerId].y)
    delete labState.workers[workerId]
    labState.workersVersion = (labState.workersVersion ?? 0) + 1
  }
  clearLabWorkerVisitStack(workerId)
}

function ensureLabLayout(server, details, chaReq) {
  const state = getLabState(server, details)
  if (!state.layout) {
    state.layout = getEstimatedLabLayout(chaReq)
    syncLabDisplayMap(state, true)
  }
  return state.layout
}

// ---------------------------------------------------------------------------
// Completion bookkeeping.  Keep the live labyrinth state object intact so
// shared sections such as deadEndEntries are never cloned away from the
// worker-visible copy.
// ---------------------------------------------------------------------------
function getCompletedLabStateRef(state) {
  return state ?? null
}
function setCompletedLabState(answer, state, serverName = "") {
  labComplete = true
  labCompleteAnswer = typeof answer === "string" ? answer : ""
  labCompleteMap = state ? buildLabMapSnapshotRows(state).slice() : null
  labCompleteServerName = serverName || state?.serverName || labState?.serverName || ""
}
function getLabCompleteState() {
  return labComplete ? labState : null
}
function getLabCompleteAnswer() {
  return labCompleteAnswer || ""
}
function getLabCompleteMap() {
  return Array.isArray(labCompleteMap) ? labCompleteMap.slice() : null
}
function getLabCompleteServerName() {
  return labCompleteServerName || labState?.serverName || ""
}
function applyLabCompletionMarker(server, completedState, fallbackX, fallbackY, result) {
  const [finishX, finishY] = getLabCompletionCoords(server, fallbackX, fallbackY, result)
  if (!Number.isInteger(finishX) || !Number.isInteger(finishY)) return [null, null]
  if (completedState?.layout) {
    completedState.layout.finishX = finishX
    completedState.layout.finishY = finishY
  }
  if (completedState) completedState.finishKey = getLabKey(finishX, finishY)
  return [finishX, finishY]
}
function getLabCompletionCoords(server, fallbackX, fallbackY, result) {
  const rawCoords = getLabRawCoordsFromAuthResult(result?.authResults ?? result)
  if (Array.isArray(rawCoords)) {
    const state = (labState && labState.serverName === server) ? labState : null
    const [actualX, actualY] = getLabActualCoords(rawCoords[0], rawCoords[1], { coords: rawCoords }, state)
    if (Number.isInteger(actualX) && Number.isInteger(actualY)) return [actualX, actualY]
  }
  return [fallbackX, fallbackY]
}
// ---------------------------------------------------------------------------
// Path inference — the original solver did a BFS over recorded rooms to
// reconstruct the shortest known path from root to (x, y).  We just read
// `room.path` (which is maintained incrementally by ensureLabRoom /
// recordLabRoom).  Good enough for resync paths.
// ---------------------------------------------------------------------------
function getLabKnownOrInferredPath(state, x, y) {
  const room = state?.rooms?.[getLabKey(x, y)]
  return Array.isArray(room?.path) ? room.path.slice() : []
}

const labDecisionLog = false

// ===========================================================================
// darktest.jsx fixes — adapters that bridge the legacy lab case body in
// the puzzle-dispatch switch onto labTest.jsx's pickGreedyStep / walkOneStep.
// Without these, the case body's `pickLabClaimAt` calls return null every
// iteration (signature mismatch) and the worker never moves.
// ===========================================================================

// Bind labState to the global `inProgress` Map for the server we just
// touched, so legacy `inProgress.get(server)` reads in the case body see
// the right state object.  No-op when inProgress is unavailable.
function syncLabToInProgress(server) {
  if (typeof server !== "string" || !server) return
  if (typeof inProgress?.set !== "function") return
  if (labState && labState.serverName === server) {
    syncLabSharedSections(labState)
    inProgress.set(server, labState)
  }
}

// Legacy-form picker.  Adapter around pickGreedyStep:
//   * Accepts the (server, workerId, x, y, skipKeys) shape used by the
//     case body's pickLabClaimAt closure.
//   * Resolves `server` to the bound labState via ensureLabState.
//   * Calls the underlying greedy picker.
//   * Pads the return value with the fields the legacy walkLabToTarget
//     and case-body post-arrival code reads (key, path, travelPath,
//     routeRoomNext, fromX/fromY, influenceSignature).
//
// skipKeys is passed through so blocked/dead claims are not reselected.
// Back-direction candidates intentionally bypass it.
function pickGreedyStepLegacy(server, workerId, x, y, skipKeys) {
  const state = ensureLabState(server)
  syncLabToInProgress(server)
  const pick = pickGreedyStep(state, workerId, x, y, { skipKeys })
  syncLabToInProgress(server)
  if (!pick) return null
  const targetKey = getLabKey(pick.x, pick.y)
  const targetRoom = state.rooms?.[targetKey]
  return {
    key: targetKey,
    x: pick.x,
    y: pick.y,
    dir: pick.dir,
    backstep: pick.backstep === true,
    path: Array.isArray(targetRoom?.path) ? targetRoom.path.slice() : [],
    travelPath: [pick.dir],
    routeRoomNext: { [getLabKey(x, y)]: pick.dir },
    fromX: x,
    fromY: y,
    influenceSignature: ""
  }
}

// Legacy-form walker.  Bridges walkLabToTarget's contract onto walkOneStep.
// Per iteration, looks up the dir for the current cell from
// target.routeRoomNext (set by the picker for the from-cell only); if
// absent — because the worker has moved past the from-cell mid-walk —
// re-picks fresh from the current cell so a multi-step walk doesn't
// strand itself.  Translates walkOneStep's compact result into the rich
// shape (arrived / blocked / desynced / finished / workerExited /
// stepLimit / noRoute, plus stepsTaken / currentX / currentY) the case
// body branches on.
async function walkLabToTarget(ns, server, details, workerId, labWorker, target, options = {}) {
  const result = { stepsTaken: 0, finished: false, arrived: false }
  if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y)) {
    result.missingTarget = true
    return result
  }
  syncLabToInProgress(server)
  const limit = Number.isFinite(options?.maxSteps) && options.maxSteps > 0
    ? Math.floor(options.maxSteps)
    : 1
  const startPos = getLabWorkerPosition(server, workerId)
  if (!startPos) {
    result.missingPosition = true
    return result
  }
  let [currentX, currentY] = startPos
  let lastReport = false
  while (result.stepsTaken < limit) {
    if (currentX === target.x && currentY === target.y) {
      result.arrived = true
      result.currentX = currentX
      result.currentY = currentY
      result.report = lastReport
      return result
    }
    let dir = target.routeRoomNext?.[getLabKey(currentX, currentY)]
    if (!dir || !labDirections[dir]) {
      const greedy = pickGreedyStep(labState, workerId, currentX, currentY)
      if (!greedy) {
        result.noRoute = true
        result.currentX = currentX
        result.currentY = currentY
        return result
      }
      dir = greedy.dir
    }
    const moved = await walkOneStep(ns, server, details, workerId, labWorker, dir, currentX, currentY)
    result.stepsTaken++
    if (moved.workerExited) {
      result.workerExited = true
      return result
    }
    if (moved.lostServer) {
      result.lostServer = true
      result.currentX = moved.currentX
      result.currentY = moved.currentY
      return result
    }
    if (moved.finished) {
      result.finished = true
      result.authResults = moved.authResults
      if (Number.isInteger(moved.exitX) && Number.isInteger(moved.exitY)) {
        result.exitX = moved.exitX
        result.exitY = moved.exitY
      } else {
        const [fx, fy] = getLabExitCoordsFromStep(labState, currentX, currentY, dir, moved.authResults)
        result.exitX = fx
        result.exitY = fy
      }
      return result
    }
    if (moved.blocked) {
      result.blocked = true
      result.currentX = moved.currentX
      result.currentY = moved.currentY
      return result
    }
    if (moved.desynced) {
      result.desynced = true
      result.currentX = moved.currentX
      result.currentY = moved.currentY
      return result
    }
    if (moved.moved) {
      currentX = moved.currentX
      currentY = moved.currentY
      if (moved.quadrantCrossed) {
        result.quadrantCrossed = true
        result.currentX = currentX
        result.currentY = currentY
        return result
      }
      if (currentX === target.x && currentY === target.y) {
        result.arrived = true
        result.currentX = currentX
        result.currentY = currentY
        return result
      }
    }
  }
  result.stepLimit = true
  result.currentX = currentX
  result.currentY = currentY
  return result
}
