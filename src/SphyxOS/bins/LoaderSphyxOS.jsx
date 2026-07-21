/**Author:
 * Discord: Sphyxis
 */
import { getResetInf, getOwnedSF, runIt, proxy, getServersLight, getServerAvailRam, getSyms, getPosi } from "SphyxOS/util.js"
const version = "v3.0.5.18"
const loaderConfigFile = "SphyxOSUserData/loaderData/config.txt"
const currentJSON = "SphyxOSUserData/loaderData/SphyxOS.txt"
const updatedJSON = "SphyxOSUserData/loaderData/SphyxOSNew.txt"
const hashKeyFileName = "SphyxOS/special/hashKey.txt"
const discordInviteUrl = "https://discord.gg/BScc48TK8Z"
const gitHubIssueUrl = "https://github.com/Sphyxis/SphyxOS/issues"
const openDB = new Set
let optionsDB = {}
let resetInfo
let sourceFiles
let wnd
/*Static port numbers for comms:
 * 1  - this script (loader) receive
 * 2  - puppetMini: emit pid
 * 3  - puppetMini: emit bestTarget
 * 4  - stocks: emit pid
 * 5  - ipvgo: emit pid
 * 6  - gangs: emit pid
 * 7  - sleeves: emit pid
 * 8  - BB: emit pid
 * 9  - corps: emit pid
 * 10 - casino: emit pid
 * 11 - stanek: emit pid
 * 12 - puppetMini receive
 * 13 - stocks receive
 * 15 - ipvgo receive
 * 16 - gangs receive
 * 17 - sleeves receive
 * 18 - BB receive
 * 19 - corps receive
 * 20 - grafting: emit pid
 * 21 - autopilot: emit pid
 * 22 - autopilot receive
 * 23 - grafting basic/adv: receive
 * 24 - darknet kill switch port
 * 25 - darknet receive
 * 26 - darknet emit active
 * 27 - minesweeper: emit pid
 * 28 - theme editor: emit pid
 * 29 - timberman: emit pid
 * 30 - autoInfil
 */
/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  const gameInfo = ns.ui.getGameInfo()
  const staticInfo = {
    versionNum: gameInfo?.versionNumber ?? "<=43",
    versionName: gameInfo.version,
    versionCommit: gameInfo.commit,
    platform: gameInfo.platform
  }

  await ns.asleep(10) //Give stuff time to end.  Issues when updating.
  resetInfo = await getResetInf(ns)
  sourceFiles = await getOwnedSF(ns)
  if (hasBN(resetInfo, sourceFiles, 13)) await proxy(ns, "stanek.acceptGift")
  //optionsDB = []
  if (globalThis["document"].autopilot) optionsDB["AutoPilotMoveOn"] = globalThis["document"].autopilot
  await loadLoaderConfig(ns)
  ns.atExit(() => {
    saveLoaderConfig(ns)
  })

  if (ns.args.includes("BBRestart")) { //Restart from BB
    if (hasBN(resetInfo, sourceFiles, 10)) { //Sleeves
      optionsDB["SleeveMode"] = "BB"
      optionsDB["BBFinisher"] = true
      await buttonBBStart(ns)
      await buttonBatcherStart(ns)
    }
  }
  if (ns.args.includes("autoPilot")) { //Restart from autoPilot
    if (hasBN(resetInfo, sourceFiles, 4, 2)) {
      ns.writePort(22, "silent")
      ns.writePort(22, optionsDB["AutoPilotMoveOn"] ? "moveon" : "nomoveon")
      await runIt(ns, "SphyxOS/bins/autopilot.js", true, [])
    }
  }
  wnd = globalThis["window"]
  ns.clearLog()
  ns.ui.openTail()
  if (optionsDB["DisplayToggleAutoUpdate"]) buttonDisplayUpdate(ns)
  ns.printRaw(<LoaderApp ns={ns} staticInfo={staticInfo}></LoaderApp>)
  await new Promise(() => { })
}
/** @param {NS} ns */
async function buttonDisplayUpdate(ns, pressed = false, destructive = false) {
  async function updateNow() {
    await buttonDisplayClearActive(ns)
    if (optionsDB["DisplayToggleUpdateVersion"] === "Stable") await ns.wget("https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOS.txt", updatedJSON)
    else if (optionsDB["DisplayToggleUpdateVersion"] === "Beta") await ns.wget("https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOSBeta.txt", updatedJSON)
    if (ns.read(updatedJSON) === "") {
      ns.toast("Aborted update.  Could not download update files.", "WARNING", 3000)
      return
    }
    await ns.asleep(100)
    await proxy(ns, "rm", currentJSON)
    ns.mv(ns.self().server, updatedJSON, currentJSON)
    if (ns.self().server !== "home") await proxy(ns, "rm", currentJSON, "home")
    await ns.asleep(4)
    ns.scp(currentJSON, "home")
    await ns.asleep(4)
    ns.exec("SphyxOS/extras/update.js", "home")
    ns.ui.closeTail()
    ns.exit()
  }
  if (optionsDB["DisplayToggleUpdateVersion"] === "Stable") await ns.wget("https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOSHash.txt", "hash.txt")
  else if (optionsDB["DisplayToggleUpdateVersion"] === "Beta") await ns.wget("https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOSBetaHash.txt", "hash.txt")
  ns.scp(hashKeyFileName, ns.self().server, "home")
  const current = ns.read(hashKeyFileName)
  const update = ns.read("hash.txt")
  if (pressed && update === "") {
    ns.toast("Update hash failed to download", "WARNING", 3000)
    return
  }
  else if (update === "") return

  if (pressed && current === "") {
    const answer = await ns.prompt("No baseline detected.  Would you like to stop everything, update and set your baseline build?", { type: "boolean" })
    if (answer === true) await updateNow()
  }
  else if (current !== update) {
    const answer = await ns.prompt("An update is available.  Would you like stop everything and update?", { type: "boolean" })
    if (answer === true) await updateNow()
  }
  else if (pressed) {
    const answer = await ns.prompt("No update found.  Would you like stop everything and refresh your install?", { type: "boolean" })
    if (answer === true) await updateNow()
  }
}
/** @param {NS} ns */
async function buildSnapshot(ns) {
  processCommands(ns)// First pull in any cross-script messages that were sent to the loader on port 1.
  wnd = globalThis["window"]// Refresh our cached window reference because some status flags live on the browser window.
  const hasCorp = await proxy(ns, "corporation.hasCorporation")// Do we have a Corp?
  const hasBB = await proxy(ns, "bladeburner.inBladeburner")// Are we in BladeBurner?
  const corp = hasCorp ? await proxy(ns, "corporation.getCorporation") : false// If we have a Corp, get it
  const player = await proxy(ns, "getPlayer")// Refresh the Player
  resetInfo = await getResetInf(ns)//Refresh this info
  sourceFiles = await getOwnedSF(ns)//Refresh this info
  const ownedSFValue = resetInfo.ownedSF?.has(resetInfo.currentNode) ? resetInfo.ownedSF.get(resetInfo.currentNode) : 0
  return {
    options: { ...optionsDB },// Clone optionsDB into a new object so React receives a fresh immutable value.
    ports: {// Cache all relevant port reads in one place so render code can stay simple.
      batcher: ns.peek(2),
      batcherTarget: ns.peek(3),
      stocks: ns.peek(4),
      ipvgo: ns.peek(5),
      gangs: ns.peek(6),
      sleeves: ns.peek(7),
      bb: ns.peek(8),
      corp: ns.peek(9),
      casino: ns.peek(10),
      stanek: ns.peek(11),
      grafting: ns.peek(20),
      autopilot: ns.peek(21),
      darknet: ns.peek(26),
      minesweeper: ns.peek(27),
      themeEditor: ns.peek(28),
      timberman: ns.peek(29)
    },
    // Feature availability flags used for conditional rendering / button color.
    //currentBN: String(resetInfo.currentNode) + "." + String(resetInfo.currentNode !== 12 ? Math.max(3, Math.min(resetInfo.ownedSF.get(resetInfo.currentNode) + 1, 1)) : String(resetInfo.ownedSF.get(resetInfo.currentNode) + 1 ?? 1)),
    currentBN: String(resetInfo.currentNode) + "." + String(resetInfo.currentNode !== 12 ? Math.max(1, Math.min(ownedSFValue + 1, 3)) : String(ownedSFValue + 1)),
    hasCorp,
    hasBB,
    corp,
    player,
    keepAlive: !!wnd?.keepAlive,// Some features are tracked outside Netscript ports, so we snapshot those too.
    autoInfilRunning: !!wnd?.tmrAutoInf
  }
}
async function getDarknetStockChoices(ns) {
  const stocks = []
  const symbols = await getSyms(ns)
  for (const sym of symbols) {
    let owned = false
    const position = await getPosi(ns, sym)
    owned = (position?.[0] ?? 0) > 0 || (position?.[2] ?? 0) > 0
    stocks.push({ sym, owned })
  }
  return stocks
}
function buildDarknetStockSelection(syms = []) {
  const cleanSyms = [...new Set((Array.isArray(syms) ? syms : []).filter((sym) => typeof sym === "string" && sym !== ""))]
  return { syms: cleanSyms }
}
function normalizeDarknetStockSelection(selection) {
  if (selection && typeof selection === "object" && !Array.isArray(selection))
    return buildDarknetStockSelection(selection.syms)
  if (Array.isArray(selection))
    return buildDarknetStockSelection(selection)
  if (selection === "All")
    return buildDarknetStockSelection()
  if (typeof selection === "string" && selection !== "")
    return buildDarknetStockSelection([selection])
  return buildDarknetStockSelection()
}
function isDarknetStockAllSelection(selection, stocks) {
  const normalizedSelection = normalizeDarknetStockSelection(selection)
  return stocks.length > 0
    && normalizedSelection.syms.length === stocks.length
    && stocks.every((stock) => normalizedSelection.syms.includes(stock.sym))
}
function getDarknetStockSelectionLabel(selection, stocks = []) {
  const normalizedSelection = normalizeDarknetStockSelection(selection)
  if (normalizedSelection.syms.length === 0) return "None"
  if (isDarknetStockAllSelection(normalizedSelection, stocks)) return "All"
  if (normalizedSelection.syms.length === 1) return normalizedSelection.syms[0] ?? "None"
  if (normalizedSelection.syms.length > 1) return "Multi"
  return "None"
}
function normalizeHashAutoTarget(target) {
  const hashTarget = typeof target === "string" ? target : "None"
  return hashAutoTargetOptions.some((option) => option.value === hashTarget) ? hashTarget : "None"
}
function getHashAutoTargetLabel(target) {
  const hashTarget = normalizeHashAutoTarget(target)
  return hashAutoTargetOptions.find((option) => option.value === hashTarget)?.label ?? "None"
}
function normalizeSleeveTrainingSelection(selection) {
  if (selection === "Idle") return "None"
  const sleeveTraining = typeof selection === "string" ? selection : "None"
  return sleeveTrainingOptions.some((option) => option.value === sleeveTraining) ? sleeveTraining : "None"
}
function getSleeveTrainingLabel(selection) {
  const sleeveTraining = normalizeSleeveTrainingSelection(selection)
  return sleeveTrainingOptions.find((option) => option.value === sleeveTraining)?.label ?? "None"
}
function isSleeveTrainingAvailable(selection) {
  const sleeveTraining = normalizeSleeveTrainingSelection(selection)
  return sleeveTraining !== "Int" || hasBN(resetInfo, sourceFiles, 10, 1)
}
function normalizeSleeveToggleMode(mode) {
  if (mode === "None") return "Idle"
  return mode
}
function isHashAutoTargetAvailable(target, snapshot = {}) {
  switch (normalizeHashAutoTarget(target)) {
    case "min":
    case "max":
      return !!snapshot?.ports?.batcherTarget && snapshot.ports.batcherTarget !== "NULL PORT DATA"
    case "corp":
    case "research":
      return !!snapshot?.hasCorp
    case "bbrank":
    case "bbsp":
      return !!snapshot?.hasBB
    case "None":
      return false
    default:
      return true
  }
}
function getReactLib() {
  //Lets be safe here.  Grab current react
  return globalThis["React"] ?? globalThis["window"]?.React
}
function isForceHidden(title) {
  return openDB.has("forceHide-" + title)
}
function toggleForceHide(title) {
  const key = "forceHide-" + title
  if (openDB.has(key))
    openDB.delete(key)
  else
    openDB.add(key)
}
function clearForceHidden() {
  for (const key of [...openDB]) {
    if (key.startsWith("forceHide-"))
      openDB.delete(key)
  }
}
function normalizeHoverButtonLabel(label) {
  //Returns the regular lable name always
  const trimmedLabel = (label ?? "").trim()
  if (trimmedLabel.startsWith("Stock:"))
    return "Stock"
  if (trimmedLabel.startsWith("Training:"))
    return "Training"
  switch (trimmedLabel) {
    case "De-Activate":
      return "Activate"
    case "Unshare Ram":
      return "Share Ram"
    case "Bribe Unavailable":
      return "Bribe"
    case "Pls Wait":
      return "Charge"
    case "Money":
    case "MinSec":
    case "MaxMoney":
    case ".cct's":
    case "C-Money":
    case "C-Research":
    case "BBRank":
    case "BBSp":
    case "Study":
    case "Train":
    case "Job Favor":
      return "No AutoHash"
    default:
      return trimmedLabel
  }
}
function getButtonHelp(rowTitle, label) {
  const normalizedLabel = normalizeHoverButtonLabel(label)
  const rowHelp = hoverHelpDB[rowTitle] ?? {}
  return rowHelp[normalizedLabel] ?? `No hover help has been written yet for ${rowTitle} / ${normalizedLabel}.`
}
function HoverHelp({ text, position, enabled }) {
  const React = getReactLib()
  React.useEffect(() => {
    const doc = globalThis["document"]
    if (!doc?.body) return
    let node = doc.getElementById("sphyxos-hover-help")
    if (!node) {
      node = doc.createElement("div")
      node.id = "sphyxos-hover-help"
      doc.body.appendChild(node)
    }
    if (!enabled || !text) {
      node.style.display = "none"
      node.innerText = ""
      return
    }
    node.style.position = "fixed"
    node.style.zIndex = "9999"
    node.style.left = `${position.x}px`
    node.style.top = `${position.y}px`
    node.style.maxWidth = "360px"
    node.style.minWidth = "220px"
    node.style.padding = "10px 12px"
    node.style.border = "1px solid #3f6b99"
    node.style.borderRadius = "6px"
    node.style.background = "rgba(0, 0, 0, 0.96)"
    node.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.35)"
    node.style.color = "#f5f7fa"
    node.style.fontFamily = "monospace"
    node.style.fontSize = "13px"
    node.style.lineHeight = "1.35"
    node.style.whiteSpace = "pre-wrap"
    node.style.pointerEvents = "none"
    node.style.transform = "translateY(-100%)"
    node.style.display = "block"
    node.innerText = text
    return () => {
      node.style.display = "none";
      node.innerText = "";
    }
  }, [text, position.x, position.y, enabled])
  return ""
}
function LoaderApp({ ns, staticInfo }) {
  //Get our current React lib
  const React = getReactLib()
  // If React is missing, render a small fallback message instead of crashing on hook usage.  Be safe
  if (!React) return <div>{"React runtime unavailable in this Bitburner session."}</div>
  // This is the component's central piece of state
  // snapshot stores the latest game/UI data gathered by buildSnapshot(ns)
  // Whenever this state changes, React rerenders the Loader UI automatically
  const [snapshot, setSnapshot] = React.useState(null)
  const [hoverHelp, setHoverHelp] = React.useState("")
  const [hoverPosition, setHoverPosition] = React.useState({ x: 0, y: 0 })
  const [activeToolbarMenu, setActiveToolbarMenu] = React.useState("")
  const [rowVisibilityVersion, setRowVisibilityVersion] = React.useState(0)
  const [displayViewMode, setDisplayViewMode] = React.useState(optionsDB["DisplayViewMode"] ?? "Mini")
  const [miniSelectedRows, setMiniSelectedRows] = React.useState(Array.isArray(optionsDB["MiniSelectedRows"]) ? [...optionsDB["MiniSelectedRows"]] : [])
  const runAction = async (action) => {
    // Run the underlying loader action (toggle option, start script, etc)
    const actionResult = await action()
    if (actionResult === "refreshRows")
      setRowVisibilityVersion((value) => value + 1)
    // Refresh state right after the action so the user sees the update immediately
    setSnapshot(await buildSnapshot(ns))
  }
  // This effect starts the live refresh loop for the UI
  // It runs once for this ns instance, then keeps polling game state on a timer
  React.useEffect(() => {
    // cancelled prevents setState calls after unmount, which would cause warnings
    // or leave background polling running after the UI is gone
    let cancelled = false
    // We keep the timer id so we can cancel the scheduled refresh during cleanup
    let timer
    // tick performs one full state refresh cycle:
    // 1. read live game/script state
    // 2. push it into React state
    // 3. schedule the next refresh
    const tick = async () => {
      // Build one immutable snapshot of everything the UI needs right now
      const next = await buildSnapshot(ns)
      // Only update React state if the component is still mounted
      // This rerender is what makes the UI visually update
      if (!cancelled) setSnapshot(next)
      //Autohashing goes here since we need a current snapshot and to constantly run it
      if (optionsDB["HashAutoTarget"] !== "None" && isHashAutoTargetAvailable(optionsDB["HashAutoTarget"], next)) await buttonHashing(ns, optionsDB["HashAutoTarget"])

      // Schedule the next polling pass. Using setTimeout instead of setInterval
      // avoids overlapping refreshes if a snapshot read takes longer than expected
      if (!cancelled) timer = setTimeout(tick, 200)
    }
    // Start the polling loop immediately when the component mounts.  No await so it's async in the background
    tick()
    // Cleanup runs when the component unmounts or if ns ever changes
    // It stops future rerenders and cancels the pending timer
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // The effect only depends on ns, so it behaves like "mount once per script instance"
  }, [ns])
  React.useEffect(() => {
    if (snapshot && !snapshot.options["DisplayToggleHelper"] && hoverHelp)
      setHoverHelp("")
  }, [snapshot?.options["DisplayToggleHelper"]])
  React.useEffect(() => {
    optionsDB["DisplayViewMode"] = displayViewMode
  }, [displayViewMode])
  React.useEffect(() => {
    optionsDB["MiniSelectedRows"] = [...miniSelectedRows]
  }, [miniSelectedRows])
  React.useEffect(() => {
    if (!snapshot) return
    const savedDisplayViewMode = snapshot.options["DisplayViewMode"] ?? "Mini"
    if (savedDisplayViewMode !== displayViewMode)
      setDisplayViewMode(savedDisplayViewMode)
    const savedMiniSelectedRows = Array.isArray(snapshot.options["MiniSelectedRows"]) ? snapshot.options["MiniSelectedRows"] : []
    if (savedMiniSelectedRows.length !== miniSelectedRows.length || savedMiniSelectedRows.some((title, index) => title !== miniSelectedRows[index]))
      setMiniSelectedRows([...savedMiniSelectedRows])
  }, [snapshot?.options["DisplayViewMode"], snapshot?.options["MiniSelectedRows"]])
  const rows = snapshot ? buildRows(ns, snapshot, runAction, staticInfo) : []
  const visibleRows = rows.filter((row) => !isForceHidden(row[0]))
  const unlockedVisibleRows = visibleRows.filter((row) => rowUnlocked(row))
  React.useEffect(() => {
    if (snapshot === null) return
    if (unlockedVisibleRows.length === 0) {
      if (miniSelectedRows.length > 0) setMiniSelectedRows([])
      return
    }
    const unlockedRowTitles = unlockedVisibleRows.map((row) => row[0].toString())
    const validSelectedRows = miniSelectedRows.filter((title) => unlockedRowTitles.includes(title))
    if (validSelectedRows.length !== miniSelectedRows.length)
      setMiniSelectedRows(validSelectedRows)
  }, [snapshot, miniSelectedRows, unlockedVisibleRows])
  // On the very first render we have not collected game state yet,
  // so show a temporary loading message until we have that info
  if (snapshot === null) return <div>{"Loading SphyxOS..."}</div>
  const handleRowHideToggle = (title) => {
    toggleForceHide(title)
    setRowVisibilityVersion((value) => value + 1)
  }
  const handleUnhideAll = () => {
    clearForceHidden()
    setRowVisibilityVersion((value) => value + 1)
  }
  const handleHoverCapture = (event) => {
    if (!snapshot?.options["DisplayToggleHelper"]) return
    const button = event.target.closest?.("button")
    if (!button) return
    if (button.dataset?.nohover === "true") return
    const rowElement = button.closest?.("[data-row]")
    const rowTitle = rowElement?.dataset?.row ?? "Display"
    const label = button.textContent?.trim() ?? ""
    setHoverPosition({ x: (event.clientX ?? 0) + 8, y: (event.clientY ?? 0) - 8 })
    setHoverHelp(getButtonHelp(rowTitle, label))
  }
  const handleHoverOutCapture = (event) => {
    const button = event.target.closest?.("button")
    if (!button) return
    const nextButton = event.relatedTarget?.closest?.("button")
    if (!nextButton) setHoverHelp("")
  }
  const handleMouseMoveCapture = (event) => {
    if (!hoverHelp || !snapshot?.options["DisplayToggleHelper"]) return
    setHoverPosition({ x: (event.clientX ?? 0) + 8, y: (event.clientY ?? 0) - 8 })
  }
  const handleMouseDownCapture = (event) => {
    if (!activeToolbarMenu) return
    const insideToolbarMenu = event.target.closest?.("[data-toolbar-menu='true']")
    if (!insideToolbarMenu) setActiveToolbarMenu("")
  }
  // Render the full application:
  // 1. header/version info
  // 2. global display/action buttons
  // 3. all unlocked control rows
  return (
    <div onMouseDownCapture={handleMouseDownCapture} onMouseOverCapture={handleHoverCapture} onMouseOutCapture={handleHoverOutCapture} onMouseMoveCapture={handleMouseMoveCapture}>
      {/* Global controls use the same snapshot and action wrapper as the row buttons. */}
      <DisplayButtons ns={ns} snapshot={snapshot} runAction={runAction} onUnhideAll={handleUnhideAll} staticInfo={staticInfo} activeToolbarMenu={activeToolbarMenu} setActiveToolbarMenu={setActiveToolbarMenu} setHoverHelp={setHoverHelp} displayViewMode={displayViewMode} setDisplayViewMode={setDisplayViewMode}></DisplayButtons>
      <HoverHelp text={hoverHelp} position={hoverPosition} enabled={snapshot.options["DisplayToggleHelper"]}></HoverHelp>
      {/* For each configured row:
          1. check whether the player has access to it in the current BitNode / Source-File setup
          2. render the row if unlocked*/}
      {displayViewMode === "Mini"
        ? <MiniView rows={unlockedVisibleRows} selectedRows={miniSelectedRows} onToggleRow={(title) => setMiniSelectedRows((currentRows) => currentRows.includes(title) ? currentRows.filter((rowTitle) => rowTitle !== title) : [...currentRows, title])} onHideToggle={handleRowHideToggle} onMiniRowContextHide={handleRowHideToggle} rowVisibilityVersion={rowVisibilityVersion}></MiniView>
        : displayViewMode === "List" ? unlockedVisibleRows.map((row) => <Row key={row[0] + "-" + rowVisibilityVersion} title={row[0].toString()} buttons={row[3]} onHideToggle={handleRowHideToggle}></Row>)
          : "New Display Mode Here!!"}
    </div>
  )
}
function DisplayButtons({ ns, snapshot, runAction, onUnhideAll, staticInfo, activeToolbarMenu, setActiveToolbarMenu, setHoverHelp, displayViewMode, setDisplayViewMode }) {
  // Pull the options object out once so the JSX below stays readable
  const options = snapshot.options
  const hiddenCount = [...openDB].filter((key) => key.startsWith("forceHide-")).length
  const displayViews = ["List", "Mini"]
  const actionsMenuLabels = ["Join Discord!!", "Create GitHub Issue", "Clear Active", "Open Logs", "Update", "Change Log", "REMOVE PROGRAM"]
  const actionsMenuWidth = `${Math.max(...actionsMenuLabels.map((label) => label.length)) + 2}ch`
  const runToolbarAction = async (action) => {
    setActiveToolbarMenu("")
    setHoverHelp("")
    await runAction(action)
  }
  const toggleToolbarMenu = (menuName) => {
    setActiveToolbarMenu(activeToolbarMenu === menuName ? "" : menuName)
  }
  const cycleDisplayViewMode = () => {
    const currentIndex = displayViews.indexOf(displayViewMode)
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % displayViews.length
    setDisplayViewMode(displayViews[nextIndex])
  }
  const currentViewButtonStyle = displayViewMode === "Mini" ? viewModeMiniActiveStyle : viewModeButtonActiveStyle
  // Render the global toolbar for the loader
  // Every button goes through runAction so React state refreshes immediately after a click
  return (
    <div data-row="Display" style={topPanelWrapStyle}>
      <div style={topPanelInfoStyle}>
        <div>
          <div style={topPanelTitleStyle}>{"SphyxOS " + version}</div>
          <div style={topPanelMetaStyle}>{"Game: " + staticInfo.versionName + " (v" + staticInfo.versionNum + " - " + staticInfo.versionCommit + ")"}</div>
          <div style={topPanelMetaStyle}>{staticInfo.platform + (snapshot.currentBN !== "1.1" ? "  BN: " + snapshot.currentBN : "")}</div>
          <button data-nohover="true" style={options["DisplayToggleAutoUpdate"] ? displayStatusOnStyle : displayStatusOffStyle} onClick={() => runAction(() => buttonDisplayToggleAutoUpdate(ns))}>{"Auto Update " + (options["DisplayToggleAutoUpdate"] ? "On" : "Off")}</button>
          <button data-nohover="true" style={options["DisplayToggleUpdateVersion"] ? displayStatusOnStyle : displayStatusOffStyle} onClick={() => runAction(() => buttonDisplayToggleUpdateVersion(ns))}>{options["DisplayToggleUpdateVersion"]}</button>

        </div>
        <div style={displayStatusTrayStyle}>
          <button data-nohover="true" style={displayThemeEditorStyle} onClick={() => runAction(() => buttonThemeEditorStart(ns))}>{"Theme Editor"}</button>
          <button data-nohover="true" style={options["DisplayToggleHelper"] ? displayStatusOnStyle : displayStatusOffStyle} onClick={() => runAction(() => buttonDisplayToggleHelper(ns))}>{"Helper " + (options["DisplayToggleHelper"] ? "On" : "Off")}</button>
          <button data-nohover="true" style={hiddenCount > 0 ? displayStatusWarnStyle : displayStatusMutedStyle} onClick={onUnhideAll}>{"Hidden " + hiddenCount}</button>
        </div>
      </div>
      <div style={toolbarBarStyle}>
        <div data-toolbar-menu="true" style={toolbarMenuStyle}>
          <button data-nohover="true" style={activeToolbarMenu === "Actions" ? toolbarSummaryOpenStyle : toolbarSummaryStyle} onClick={() => toggleToolbarMenu("Actions")}>{"Actions"}</button>
          {activeToolbarMenu === "Actions" && <div style={{ ...toolbarDropdownStyle, width: actionsMenuWidth }}>
            <div style={toolbarSectionTitleStyle}>{"System Actions"}</div>
            <button style={displaySecondaryStyle} onClick={() => runToolbarAction(() => buttonJoinDiscord(ns))}>{"Join Discord!!"}</button>
            <button style={displaySecondaryStyle} onClick={() => runToolbarAction(() => buttonCreateGitHubIssue(ns))}>{"Create GitHub Issue"}</button>
            <button style={displaySecondaryStyle} onClick={() => runToolbarAction(() => buttonDisplayClearActive(ns))}>{"Clear Active"}</button>
            <button style={displaySecondaryStyle} onClick={() => runToolbarAction(() => buttonDisplayOpenLogs(ns))}>{"Open Logs"}</button>
            <button style={displaySecondaryStyle} onClick={() => runToolbarAction(() => buttonDisplayUpdate(ns, true))}>{"Update"}</button>
            <button style={displaySecondaryStyle} onClick={() => runToolbarAction(() => buttonChangeLog(ns))}>{"Change Log"}</button>
            <button style={displayDangerStyle} onClick={() => runToolbarAction(() => buttonDisplayRemove(ns))}>{"REMOVE PROGRAM"}</button>
          </div>}
        </div>
        <div style={viewModeToggleWrapStyle}>
          <span style={viewModeLabelStyle}>{"View:"}</span>
          <button data-nohover="true" style={currentViewButtonStyle} onClick={cycleDisplayViewMode}>{displayViewMode}</button>
        </div>
      </div>
    </div>
  )
}
function DarknetStockSelector({ ns, snapshot, runAction } = {}) {
  const React = getReactLib()
  const [open, setOpen] = React.useState(false)
  const [stocks, setStocks] = React.useState([])
  const [loadingStocks, setLoadingStocks] = React.useState(false)
  const wrapRef = React.useRef(null)
  const stockSelection = normalizeDarknetStockSelection(snapshot?.options?.["DarknetPromoteStock"])
  const selectedSyms = stockSelection.syms
  const selectedSymSet = new Set(selectedSyms)
  const allStocksSelected = isDarknetStockAllSelection(stockSelection, stocks)
  const stockSelectionLabel = getDarknetStockSelectionLabel(stockSelection, stocks)
  const stockSelectionOwned = selectedSyms.length > 0 && (allStocksSelected || selectedSyms.length > 1 || selectedSyms.every((sym) => stocks.find((stock) => stock.sym === sym)?.owned))
  const buttonStyle = {
    ...darknetStockButtonStyle,
    ...(stockSelectionOwned ? greenStyle : redStyle)
  }
  const stockSymbolWidth = `${Math.max(3, ...stocks.map((stock) => stock.sym.length)) + 2}ch`
  const menuWidth = `calc(${stockSymbolWidth} * 4 + 12px)`
  const getStockOptionStyle = (stock) => ({
    ...(stock.owned ? darknetStockOwnedStyle : darknetStockUnownedStyle),
    ...(selectedSymSet.has(stock.sym) ? darknetStockSelectedStyle : {})
  })
  const openStockSelector = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setStocks([])
    setLoadingStocks(true)
    const freshStocks = ns ? await getDarknetStockChoices(ns) : []
    setStocks(freshStocks)
    setLoadingStocks(false)
  }
  const selectStockSelection = async (selection, closeAfterSelect = true) => {
    if (closeAfterSelect) setOpen(false)
    if (ns && runAction)
      await runAction(() => buttonDarknet(ns, "stock", selection))
  }
  const toggleStock = async (sym) => {
    const nextSyms = selectedSymSet.has(sym) ? selectedSyms.filter((selectedSym) => selectedSym !== sym)
      : [...selectedSyms, sym]
    await selectStockSelection(buildDarknetStockSelection(nextSyms), false)
  }
  React.useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event) => {
      if (!wrapRef.current?.contains?.(event.target))
        setOpen(false)
    }
    globalThis["document"]?.addEventListener?.("mousedown", closeOnOutsideClick)
    return () => globalThis["document"]?.removeEventListener?.("mousedown", closeOnOutsideClick)
  }, [open])
  return (
    <span ref={wrapRef} style={darknetStockSelectorWrapStyle}>
      <button style={buttonStyle} onClick={openStockSelector}>{"Stock: " + stockSelectionLabel}</button>
      {open && <div style={{ ...darknetStockDropdownStyle, width: menuWidth }}>
        <button data-nohover="true" style={{ ...darknetStockNoneStyle, ...(selectedSyms.length === 0 ? darknetStockSelectedStyle : {}) }} onClick={() => selectStockSelection(buildDarknetStockSelection())}>{"None"}</button>
        <button data-nohover="true" disabled={loadingStocks || stocks.length === 0} style={{ ...darknetStockAllStyle, ...(allStocksSelected ? darknetStockSelectedStyle : {}) }} onClick={() => selectStockSelection(buildDarknetStockSelection(stocks.map((stock) => stock.sym)))}>{"All"}</button>
        {loadingStocks && <button data-nohover="true" disabled style={darknetStockUnownedStyle}>{"Loading"}</button>}
        {stocks.length > 0 && <div style={darknetStockGridStyle}>
          {stocks.map((stock) => <button key={stock.sym} data-nohover="true" style={getStockOptionStyle(stock)} onClick={() => toggleStock(stock.sym)}>{stock.sym}</button>)}
        </div>}
        {!loadingStocks && stocks.length === 0 && <button data-nohover="true" disabled style={darknetStockUnownedStyle}>{"No Stocks"}</button>}
      </div>}
    </span>
  )
}
function HashAutoTargetSelector({ snapshot, runAction } = {}) {
  const React = getReactLib()
  const [open, setOpen] = React.useState(false)
  const wrapRef = React.useRef(null)
  const selectedHashTarget = normalizeHashAutoTarget(snapshot?.options?.["HashAutoTarget"])
  const selectedHashLabel = getHashAutoTargetLabel(selectedHashTarget)
  const selectedHashAvailable = isHashAutoTargetAvailable(selectedHashTarget, snapshot)
  const buttonStyle = {
    ...darknetStockButtonStyle,
    ...(selectedHashAvailable ? greenStyle : redStyle)
  }
  const hashOptionWidth = `${Math.max(...hashAutoTargetOptions.map((option) => option.label.length)) + 2}ch`
  const menuWidth = `calc(${hashOptionWidth} * 2 + 20px)`
  const getHashOptionStyle = (option) => ({
    ...(isHashAutoTargetAvailable(option.value, snapshot) ? darknetStockAllStyle : darknetStockNoneStyle),
    ...(selectedHashTarget === option.value ? darknetStockSelectedStyle : {})
  })
  const selectHashTarget = async (target) => {
    setOpen(false)
    if (runAction)
      await runAction(() => buttonHashAutoTarget(target))
  }
  React.useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event) => {
      if (!wrapRef.current?.contains?.(event.target))
        setOpen(false)
    }
    globalThis["document"]?.addEventListener?.("mousedown", closeOnOutsideClick)
    return () => globalThis["document"]?.removeEventListener?.("mousedown", closeOnOutsideClick)
  }, [open])
  return (
    <span ref={wrapRef} style={darknetStockSelectorWrapStyle}>
      <button style={buttonStyle} onClick={() => setOpen(!open)}>{selectedHashLabel === "None" ? "No AutoHash" : selectedHashLabel}</button>
      {open && <div style={{ ...darknetStockDropdownStyle, width: menuWidth }}>
        <div style={hashAutoTargetGridStyle}>
          {hashAutoTargetOptions.map((option) => <button key={option.value} data-nohover="true" style={getHashOptionStyle(option)} onClick={() => selectHashTarget(option.value)}>{option.label}</button>)}
        </div>
      </div>}
    </span>
  )
}
function SleeveTrainingSelector({ ns, snapshot, runAction } = {}) {
  const React = getReactLib()
  const [open, setOpen] = React.useState(false)
  const wrapRef = React.useRef(null)
  const selectedTraining = normalizeSleeveTrainingSelection(snapshot?.options?.["SleeveMode"])
  const selectedTrainingLabel = getSleeveTrainingLabel(selectedTraining)
  const selectedTrainingAvailable = selectedTraining !== "None" && isSleeveTrainingAvailable(selectedTraining)
  const buttonStyle = {
    ...darknetStockButtonStyle,
    ...(selectedTrainingAvailable ? greenStyle : redStyle)
  }
  const optionWidth = `${Math.max(...sleeveTrainingOptions.map((option) => option.label.length)) + 2}ch`
  const menuWidth = `calc(${optionWidth} * 3 + 24px)`
  const getTrainingOptionStyle = (option) => ({
    ...(option.value !== "None" && isSleeveTrainingAvailable(option.value) ? darknetStockAllStyle : darknetStockNoneStyle),
    ...(selectedTraining === option.value ? darknetStockSelectedStyle : {})
  })
  const selectTraining = async (selection) => {
    const nextTraining = normalizeSleeveTrainingSelection(selection)
    setOpen(false)
    if (nextTraining === selectedTraining || !isSleeveTrainingAvailable(nextTraining)) return
    if (ns && runAction)
      await runAction(() => buttonSleevesToggle(ns, nextTraining))
  }
  React.useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event) => {
      if (!wrapRef.current?.contains?.(event.target))
        setOpen(false)
    }
    globalThis["document"]?.addEventListener?.("mousedown", closeOnOutsideClick)
    return () => globalThis["document"]?.removeEventListener?.("mousedown", closeOnOutsideClick)
  }, [open])
  return (
    <span ref={wrapRef} style={darknetStockSelectorWrapStyle}>
      <button style={buttonStyle} onClick={() => setOpen(!open)}>{selectedTraining === "None" ? "Training" : "Training: " + selectedTrainingLabel}</button>
      {open && <div style={{ ...darknetStockDropdownStyle, width: menuWidth }}>
        <div style={sleeveTrainingGridStyle}>
          {sleeveTrainingOptions.map((option) => <button key={option.value} data-nohover="true" disabled={!isSleeveTrainingAvailable(option.value)} style={getTrainingOptionStyle(option)} onClick={() => selectTraining(option.value)}>{option.label}</button>)}
        </div>
      </div>}
    </span>
  )
}
function buildRows(ns, snapshot, runAction, staticInfo) {
  // Pull the current option snapshot out for shorter access in the row builders
  const options = snapshot.options
  // rows is the final ordered list returned to LoaderApp
  // Each entry is [title, requiredBN, requiredLevel, jsxButtons]
  const rows = []
  // Build reusable button fragments once so we can insert them into the row JSX below
  // without repeating the same unlock checks several times.
  const batcherUseHacknet = hasBN(resetInfo, sourceFiles, 9, 1) ? <button style={options["BatcherUseHacknet"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherUseHacknet(ns))}>{"Use Hacknet"}</button> : ""
  const batcherAutoHash = hasBN(resetInfo, sourceFiles, 9, 1) ? <button style={options["BatcherAutoHash"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherAutoHash(ns))}>{"Auto Hash"}</button> : ""
  const batcherChargeStanek = hasBN(resetInfo, sourceFiles, 13) ? <button style={options["BatcherStanek"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherToggleStanek(ns))}>{"Charge Stanek"}</button> : ""
  const batcherAutoBuyHacknet = hasBN(resetInfo, sourceFiles, 9, 1) ? <button style={options["BatcherAutoBuyHacknet"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherAutoBuyHacknet(ns))}>{"Batcher: AutoBuy"}</button> : ""
  const miscBackdoorBasic = !hasBN(resetInfo, sourceFiles, 4, 2) ? <button style={alwaysOnStyle} onClick={() => runAction(() => buttonMiscBackdoorBasic(ns))}>{"Backdoor"}</button> : ""
  const miscBackdoorSingBasic = hasBN(resetInfo, sourceFiles, 4, 2) ? <button style={alwaysOnStyle} onClick={() => runAction(() => buttonMiscBackdoorSing(ns))}>{"Backdoor Basic"}</button> : ""
  const miscBackdoorSingAll = hasBN(resetInfo, sourceFiles, 4, 2) ? <button style={alwaysOnStyle} onClick={() => runAction(() => buttonMiscBackdoorSing(ns, true))}>{"Backdoor All"}</button> : ""
  const gangSleeves = hasBN(resetInfo, sourceFiles, 10, 1) ? <button style={options["SleeveMode"] === "Gangs" ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleevesToggle(ns, "Gangs"))}>{"Sleeves"}</button> : ""
  const bbSleeves = hasBN(resetInfo, sourceFiles, 10, 1) ? <button style={options["SleeveMode"] === "BB" ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleevesToggle(ns, "BB"))}>{"Sleeves"}</button> : ""
  const bbInfilOnly = hasBN(resetInfo, sourceFiles, 10, 1) ? <button style={options["BBInfilOnly"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBBInfilOnly(ns))}>{"Infil Only"}</button> : ""
  const darknetShowMap = hasBN(resetInfo, sourceFiles, 15, 1) ? <button style={options["DarknetShowMap"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonDarknet(ns, "map"))}>{"Show Lab Map"}</button> : ""
  // KeepAlive only exists off Steam
  const keepAlive = staticInfo.platform !== "Steam" ? <button style={snapshot.keepAlive ? greenStyle : redStyle} onClick={() => runAction(() => buttonMiscKeepAlive(ns))}>{"Keep Tab Alive"}</button> : ""
  // Corp bribe availability depends on valuation and faction membership, so compute
  // the label once before creating the corp row
  let corpBribeName = "Bribe Unavailable"
  if (snapshot.corp && snapshot.corp.valuation >= 100000000000000 && snapshot.player.factions.length > 0) corpBribeName = "Bribe"
  // From here down, each rows.push(...) creates one visible section in the loader UI
  // The title and BN fields are later used by rowUnlocked(...) to decide whether to render it

  // Batcher controls
  rows.push(["Batcher", true, true, <span>
    <button style={snapshot.ports.batcher !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherStart(ns))}>{snapshot.ports.batcher === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={options["BatcherAutoBuyServers"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherAutoBuyServers(ns))}>{"Auto-Buy Servers"}</button>
    {batcherUseHacknet}
    {batcherAutoHash}<br></br>
    <button style={options["BatcherMoney"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherToggleMoney(ns))}>{"Money Mode"}</button>
    <button style={options["BatcherXP"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherToggleXP(ns))}>{"XP Mode"}</button>
    {batcherChargeStanek}
    <button style={options["BatcherPad"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherPad(ns))}>{"Pad Grows"}</button>
    <button style={options["BatcherLog"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBatcherLog(ns))}>{"LogErrors"}</button>
    <button style={options["BatcherPopout"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "Batcher"))}>{"Pop Out"}</button></span>])
  // Hacknet controls
  rows.push(["Hacknet", true, true, <span>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonHacknetBuyHacknet(ns))}>{"Buy Hacknet"}</button>
    {batcherAutoBuyHacknet}</span>])
  // Hash spending controls
  rows.push(["Hashing", 9, 1, <span>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonHashing(ns, "money"))}>{"Money"}</button>
    <button style={snapshot.ports.batcherTarget !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonHashing(ns, "min"))}>{"Reduce Min Sec"}</button>
    <button style={snapshot.ports.batcherTarget !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonHashing(ns, "max"))}>{"Boost Max Money"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonHashing(ns, "coding"))}>{"Generate Contract"}</button><br></br>
    <button style={snapshot.hasCorp ? greenStyle : redStyle} onClick={() => runAction(() => buttonHashing(ns, "corp"))}>{"Corp Money"}</button>
    <button style={snapshot.hasCorp ? greenStyle : redStyle} onClick={() => runAction(() => buttonHashing(ns, "research"))}>{"Corp Research"}</button>
    <button style={snapshot.hasBB ? greenStyle : redStyle} onClick={() => runAction(() => buttonHashing(ns, "bbrank"))}>{"Boost BB Rank"}</button>
    <button style={snapshot.hasBB ? greenStyle : redStyle} onClick={() => runAction(() => buttonHashing(ns, "bbsp"))}>{"Boost BB SP"}</button><br></br>
    <HashAutoTargetSelector snapshot={snapshot} runAction={runAction}></HashAutoTargetSelector>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonHashing(ns, "study"))}>{"Boost Study"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonHashing(ns, "train"))}>{"Boost Train"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonHashing(ns, "favor"))}>{"Boost Job Favor"}</button></span>])
  // Stock trading controls and automation toggles
  rows.push(["Stocks", true, true, <span>
    <button style={snapshot.ports.stocks !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonStocksStart(ns))}>{snapshot.ports.stocks === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={snapshot.ports.stocks !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonStocksBuy(ns))}>{"Buy"}</button>
    <button style={snapshot.ports.stocks !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonStocksSell(ns))}>{"Sell"}</button>
    <button style={options["StocksToggleAutoBuy"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonStocksToggleAutoBuy(ns))}>{"Toggle AutoBuy"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonStocksReset(ns))}>{"Reset Stats"}</button>
    <button style={options["StocksPopOut"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "Stocks"))}>{"Pop Out"}</button></span>])
  // Misc utility actions like backdooring, contract solving, RAM sharing, and keepalive
  rows.push(["Misc", true, true, <span>
    {miscBackdoorBasic}
    {miscBackdoorSingBasic}
    {miscBackdoorSingAll}
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonMiscTeleport(ns))}>{"Teleport"}</button><br></br>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonMiscSolveContracts(ns))}>{"Solve Contracts"}</button>
    <button style={options["ShareMode"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonMiscShareRam(ns))}>{options["ShareMode"] ? "Unshare Ram" : "Share Ram"}</button>
    {keepAlive}</span>])
  // Singularity
  rows.push(["Singularity", 4, 2, <span>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonSingDumpMoney(ns))}>{"Dump Money"}</button><br></br>
    <button style={snapshot.ports.autopilot !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonAutoPilot(ns))}>{"AutoPilot"}</button>
    <button style={options["AutoPilotMoveOn"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonAutoPilotMoveOn(ns))}>{"Start On Next"}</button>
    <button style={options["AutoPilotPopOut"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "AutoPilot"))}>{"Pop Out"}</button></span>])
  // Dark net
  rows.push(["DarkNet", true, true, <span>
    <button style={snapshot.ports.darknet !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonDarknet(ns, "start"))}>{snapshot.ports.darknet === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={options["DarknetStorm"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonDarknet(ns, "storm"))}>{"WebStorm"}</button>
    {darknetShowMap}<br></br>
    <DarknetStockSelector ns={ns} snapshot={snapshot} runAction={runAction}></DarknetStockSelector>
    <button style={options["DarknetPhishing"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonDarknet(ns, "phishing"))}>{"Phishing"}</button>
    <button style={options["DarknetInducing"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonDarknet(ns, "inducing"))}>{"Inducing"}</button>
    <button style={options["DarknetSharing"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonDarknet(ns, "sharing"))}>{"Sharing"}</button></span>])
  // IPvGo management
  rows.push(["IPvGo", true, true, <span>
    <button style={snapshot.ports.ipvgo !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoStart(ns))}>{snapshot.ports.ipvgo === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={options["IPvGoPlayAsWhite"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoPlayWhite(ns))}>{"Play White"}</button>
    <button style={options["IPvGoRepeat"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoRepeat(ns))}>{"Repeat"}</button>
    <button style={options["IPvGoCheats"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoCheats(ns))}>{"Cheats"}</button>
    <button style={options["IPvGoLogging"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoLogging(ns))}>{"Logging"}</button><br></br>
    <button style={options["IPvGoNetburners"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoNetburners(ns))}>{"Netburners"}</button>
    <button style={options["IPvGoSlumSnakes"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoSlumSnakes(ns))}>{"Slum Snakes"}</button>
    <button style={options["IPvGoTheBlackHand"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoTheBlackHand(ns))}>{"The Black Hand"}</button>
    <button style={options["IPvGoTetrads"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoTetrads(ns))}>{"Tetrads"}</button><br></br>
    <button style={options["IPvGoDaedalus"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoDaedalus(ns))}>{"Daedalus"}</button>
    <button style={options["IPvGoIlluminati"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoIlluminati(ns))}>{"Illuminati"}</button>
    <button style={options["IPvGoUnknown"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoUnknown(ns))}>{"????????"}</button>
    <button style={options["IPvGoNoAI"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoNoAI(ns))}>{"No AI"}</button>
    <button style={options["IPvGoSlowMode"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonIPvGoSlowMode(ns))}>{"SlowMode"}</button>
    <button style={options["IPvGoPopOut"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "IPvGo"))}>{"Pop Out"}</button></span>])
  // Gang automation controls
  rows.push(["Gangs", 2, 1, <span>
    <button style={snapshot.ports.gangs !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonGangStart(ns))}>{snapshot.ports.gangs === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={options["GangAutoAscend"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonGangAutoAscend(ns))}>{"Auto-Ascend"}</button>
    <button style={options["GangAutoEQ"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonGangAutoEQ(ns))}>{"Auto-EQ"}</button>
    {gangSleeves}<br></br>
    <button style={options["GangMode"] === "AutoMode" ? greenStyle : redStyle} onClick={() => runAction(() => buttonGangMode(ns, "AutoMode"))}>{"AutoMode"}</button>
    <button style={options["GangMode"] === "Respect" ? greenStyle : redStyle} onClick={() => runAction(() => buttonGangMode(ns, "Respect"))}>{"Respect"}</button>
    <button style={options["GangMode"] === "Money" ? greenStyle : redStyle} onClick={() => runAction(() => buttonGangMode(ns, "Money"))}>{"Money"}</button>
    <button style={options["GangMode"] === "Training" ? greenStyle : redStyle} onClick={() => runAction(() => buttonGangMode(ns, "Training"))}>{"Training"}</button>
    <br></br>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonGangBuyEQ(ns))}>{"Buy EQ All"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonGangAscend(ns))}>{"Ascend All"}</button>
    <button style={options["GangPopOut"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "Gang"))}>{"Pop Out"}</button></span>])
  // Corporation startup
  rows.push(["Corps", 3, 3, <span>
    <button style={snapshot.ports.corp !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonCorpStart(ns))}>{snapshot.ports.corp === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonCorpResetTAII(ns))}>{"Reset TAII"}</button>
    <button style={corpBribeName === "Bribe" ? greenStyle : redStyle} onClick={() => runAction(() => buttonCorpBribe(ns))}>{corpBribeName}</button>
    <button style={options["CorpPopOut"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "Corp"))}>{"Pop Out"}</button></span>])
  // Bladeburner controls
  rows.push(["BladeBurner", 6, 1, <span>
    <button style={snapshot.ports.bb !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonBBStart(ns))}>{snapshot.ports.bb === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={options["BBFinisher"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBBFinisher(ns))}>{"Finisher"}</button>
    <button style={options["BBIntMode"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonBBIntMode(ns))}>{"Int Mode"}</button>
    {bbSleeves}
    {bbInfilOnly}
    <button style={options["BBPopOut"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "BB"))}>{"Pop Out"}</button></span>])
  // Stanek
  rows.push(["Stanek", 13, 1, <span>
    <button style={snapshot.ports.stanek !== "NULL PORT DATA" ? redStyle : greenStyle} onClick={() => runAction(() => buttonStanekStart(ns))}>{snapshot.ports.stanek === "NULL PORT DATA" ? "Charge" : "Pls Wait"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonStanekSaveConfig(ns))}>{"Save Config"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonStanekLoadConfig(ns))}>{"Load Config"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonStanekDeleteConfig(ns))}>{"Delete Config"}</button>
    <button style={options["StanekDefault"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonStanekUseDefault(ns))}>{"Defaults"}</button></span>])
  // Sleeve manager controls
  rows.push(["Sleeves", 10, 1, <span>
    <button style={snapshot.ports.sleeves !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleeveStart(ns))}>{snapshot.ports.sleeves === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={options["SleeveMode"] === "Recovery" ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleevesToggle(ns, "Recovery"))}>{"Recovery"}</button>
    <button style={options["SleeveMode"] === "Sync" ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleevesToggle(ns, "Sync"))}>{"Sync"}</button>
    <button style={options["SleeveInstall"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleevesInstallAugments(ns))}>{"Install Augments"}</button>
    <button style={options["SleevePopOut"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "Sleeve"))}>{"Pop Out"}</button><br></br>
    <SleeveTrainingSelector ns={ns} snapshot={snapshot} runAction={runAction}></SleeveTrainingSelector>
    <button style={options["SleeveMode"] === "Money" ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleevesToggle(ns, "Money"))}>{"Cash"}</button>
    <button style={options["SleeveMode"] === "Karma" ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleevesToggle(ns, "Karma"))}>{"Karma"}</button>
    <button style={options["SleeveMode"] === "Idle" ? greenStyle : redStyle} onClick={() => runAction(() => buttonSleevesToggle(ns, "Idle"))}>{"Idle"}</button>
  </span>])
  // Auto-grafting
  rows.push(["Grafting", 10, 1, <span>
    <button style={snapshot.ports.grafting !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonGrafting(ns))}>{snapshot.ports.grafting === "NULL PORT DATA" ? "Activate" : "De-Activate"}</button>
    <button style={options["GraftingPopOut"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonPopout(ns, "Grafting"))}>{"Pop Out"}</button></span>])
  // Auto-grafting
  rows.push(["Games", true, true, <span>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonGameDoom(ns))}>{"DOOM"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonGameMinesweeper(ns))}>{"Minesweeper"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonGameTimberman(ns))}>{"Timberman"}</button></span>])
  // Developer / cheat utilities
  rows.push(["Cheats", true, true, <span>
    {"Dev/Unlocks" + getBuffer(11)}<button style={alwaysOnStyle} onClick={() => runAction(() => buttonDevMenu(ns))}>{"Dev Menu"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonNotDevMenu(ns))}>{"NOT the Dev Menu"}</button>
    <button style={alwaysOnStyle} onClick={() => runAction(() => buttonUnlockAll(ns))}>{"Unlock All Achievements"}</button><br></br>
    {"Casino" + getBuffer(6)}<button style={snapshot.ports.casino !== "NULL PORT DATA" ? greenStyle : redStyle} onClick={() => runAction(() => buttonCasinoStart(ns))}>{"Casino"}</button><br></br>
    {"AutoInfil" + getBuffer(9)}<button style={snapshot.autoInfilRunning ? greenStyle : redStyle} onClick={() => runAction(() => buttonAutoInfilStart(ns))}>{!snapshot.autoInfilRunning ? "Activate" : "De-Activate"}</button>
    <button style={options["AutoInfilAuto"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonAutoInfilAuto(ns))}>{"Auto"}</button>
    <button style={options["AutoInfilMoneyMode"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonAutoInfilMoney(ns))}>{"Money"}</button>
    <button style={options["AutoInfilFactionMode"] ? greenStyle : redStyle} onClick={() => runAction(() => buttonAutoInfilFaction(ns))}>{"Faction"}</button>{options["AutoInfilFaction"]}</span>])
  // Return the completed row list to LoaderApp for filtering and rendering.
  return rows
}
function rowUnlocked([sendTitle, bn, lvl]) {
  if (bn === true && lvl === true) return true
  else if (bn === false && lvl === false) return false
  return hasBN(resetInfo, sourceFiles, bn, lvl)
    || (bn === 6 && hasBN(resetInfo, sourceFiles, 7, lvl))
}
const commandHandlers = {
  "puppet money on": () => { optionsDB["BatcherMoney"] = true },
  "puppet money off": () => { optionsDB["BatcherMoney"] = false },
  "puppet xp on": () => { optionsDB["BatcherXP"] = true },
  "puppet xp off": () => { optionsDB["BatcherXP"] = false },
  "puppet autobuyservers on": () => { optionsDB["BatcherAutoBuyServers"] = true },
  "puppet autobuyservers off": () => { optionsDB["BatcherAutoBuyServers"] = false },
  "puppet autohash on": () => { optionsDB["BatcherAutoHash"] = true },
  "puppet autohash off": () => { optionsDB["BatcherAutoHash"] = false },
  "puppet stanek on": () => { optionsDB["BatcherStanek"] = true },
  "puppet stanek off": () => { optionsDB["BatcherStanek"] = false },
  "puppet hacknet on": () => { optionsDB["BatcherUseHacknet"] = true },
  "puppet hacknet off": () => { optionsDB["BatcherUseHacknet"] = false },
  "puppet autobuyhacknet on": () => { optionsDB["BatcherAutoBuyHacknet"] = true },
  "puppet autobuyhacknet off": () => { optionsDB["BatcherAutoBuyHacknet"] = false },
  "puppet popout off": () => { optionsDB["BatcherPopout"] = false },
  "puppet log on": () => { optionsDB["BatcherLog"] = true },
  "puppet log off": () => { optionsDB["BatcherLog"] = false },
  "puppet pad on": () => { optionsDB["BatcherPad"] = true },
  "puppet pad off": () => { optionsDB["BatcherPad"] = false },
  "ipvgo repeat on": () => { optionsDB["IPvGoRepeat"] = true },
  "ipvgo repeat off": () => { optionsDB["IPvGoRepeat"] = false },
  "ipvgo playaswhite off": () => { optionsDB["IPvGoPlayAsWhite"] = false },
  "ipvgo playaswhite on": () => { optionsDB["IPvGoPlayAsWhite"] = true },
  "ipvgo cheats on": () => { optionsDB["IPvGoCheats"] = true },
  "ipvgo cheats off": () => { optionsDB["IPvGoCheats"] = false },
  "ipvgo logging on": () => { optionsDB["IPvGoLogging"] = true },
  "ipvgo logging off": () => { optionsDB["IPvGoLogging"] = false },
  "ipvgo net on": () => { optionsDB["IPvGoNetburners"] = true },
  "ipvgo net off": () => { optionsDB["IPvGoNetburners"] = false },
  "ipvgo slum on": () => { optionsDB["IPvGoSlumSnakes"] = true },
  "ipvgo slum off": () => { optionsDB["IPvGoSlumSnakes"] = false },
  "ipvgo bh on": () => { optionsDB["IPvGoTheBlackHand"] = true },
  "ipvgo bh off": () => { optionsDB["IPvGoTheBlackHand"] = false },
  "ipvgo tetrad on": () => { optionsDB["IPvGoTetrads"] = true },
  "ipvgo tetrad off": () => { optionsDB["IPvGoTetrads"] = false },
  "ipvgo daed on": () => { optionsDB["IPvGoDaedalus"] = true },
  "ipvgo daed off": () => { optionsDB["IPvGoDaedalus"] = false },
  "ipvgo illum on": () => { optionsDB["IPvGoIlluminati"] = true },
  "ipvgo illum off": () => { optionsDB["IPvGoIlluminati"] = false },
  "ipvgo ???? on": () => { optionsDB["IPvGoUnknown"] = true },
  "ipvgo ???? off": () => { optionsDB["IPvGoUnknown"] = false },
  "ipvgo noai on": () => { optionsDB["IPvGoNoAI"] = true },
  "ipvgo noai off": () => { optionsDB["IPvGoNoAI"] = false },
  "ipvgo slowmode on": () => { optionsDB["IPvGoSlowMode"] = true },
  "ipvgo slowmode off": () => { optionsDB["IPvGoSlowMode"] = false },
  "ipvgo popout off": () => { optionsDB["IPvGoPopOut"] = false },
  "gang autoascend on": () => { optionsDB["GangAutoAscend"] = true },
  "gang autoascend off": () => { optionsDB["GangAutoAscend"] = false },
  "gang autoeq on": () => { optionsDB["GangAutoEQ"] = true },
  "gang autoeq off": () => { optionsDB["GangAutoEQ"] = false },
  "gang mode automode": () => { optionsDB["GangMode"] = "AutoMode" },
  "gang mode respect": () => { optionsDB["GangMode"] = "Respect" },
  "gang mode money": () => { optionsDB["GangMode"] = "Money" },
  "gang popout off": () => { optionsDB["GangPopOut"] = false },
  "sleeves idle": () => { optionsDB["SleeveMode"] = "Idle" },
  "sleeves popout off": () => { optionsDB["SleevePopOut"] = false },
  "stocks popout off": () => { optionsDB["StocksPopOut"] = false },
  "stocks autobuy off": () => { optionsDB["StocksToggleAutoBuy"] = false },
  "stocks autobuy on": () => { optionsDB["StocksToggleAutoBuy"] = true },
  "autopilot popout off": () => { optionsDB["AutoPilotPopOut"] = false },
  "bb finisher off": () => { optionsDB["BBFinisher"] = false },
  "bb int mode off": () => { optionsDB["BBIntMode"] = false },
  "bb sleeves on": () => { optionsDB["SleeveMode"] = "BB" },
  "bb sleeves off": () => { optionsDB["SleeveMode"] = "Idle" },
  "bb sleeve infil off": () => { optionsDB["BBInfilOnly"] = false },
  "bb popout off": () => { optionsDB["BBPopOut"] = false },
  "grafting popout off": () => { optionsDB["GraftingPopOut"] = false },
  "darknet storm off": () => { optionsDB["DarknetStorm"] = false },
  "darknet map off": () => { optionsDB["DarknetShowMap"] = false },
  "dnetStocks": (sym) => { optionsDB["DarknetPromoteStock"] = normalizeDarknetStockSelection(sym) }
}
function processCommands(ns) {
  while (ns.peek(1) !== "NULL PORT DATA") {
    const result = ns.readPort(1)
    if (result === 1 || result === true) continue // 1 and true were used to just cycle the display, anythign else is state communication
    if (result.startsWith("dnetStocks:")) commandHandlers["dnetStocks"](result.split(":")[1])
    else if (commandHandlers[result]) commandHandlers[result]()
    else ns.tprintf("Invalid response received in Loader: %s", result);
  }
}
function getBuffer(startValue, endValue = 12) {
  let buffer = ""
  for (let i = startValue; i < endValue; i++)
    buffer += " "
  buffer += ":"
  return buffer
}
function buttonDisplayToggleHelper(ns) {
  optionsDB["DisplayToggleHelper"] = !optionsDB["DisplayToggleHelper"]
}
function buttonDisplayToggleAutoUpdate(ns) {
  optionsDB["DisplayToggleAutoUpdate"] = !optionsDB["DisplayToggleAutoUpdate"]
  if (optionsDB["DisplayToggleAutoUpdate"]) buttonDisplayUpdate(ns)
}
function buttonDisplayToggleUpdateVersion(ns) {
  if (optionsDB["DisplayToggleUpdateVersion"] === "Beta") optionsDB["DisplayToggleUpdateVersion"] = "Stable"
  else optionsDB["DisplayToggleUpdateVersion"] = "Beta"
  if (optionsDB["DisplayToggleAutoUpdate"]) buttonDisplayUpdate(ns)
}
function buttonDisplayOpenLogs(ns) {
  if (ns.peek(2) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(2)) // Puppet
  if (ns.peek(4) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(4)) // Stocks
  if (ns.peek(5) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(5)) // IPvGo
  if (ns.peek(6) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(6)) // Gangs
  if (ns.peek(7) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(7)) // Sleeves
  if (ns.peek(8) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(8)) // BB
  if (ns.peek(9) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(9)) // Corps
  if (ns.peek(10) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(10)) // Casino
  if (ns.peek(20) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(20)) // Grafting
  if (ns.peek(27) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(27)) // Minesweeper
  if (ns.peek(28) !== "NULL PORT DATA") ns.ui.openTail(ns.peek(28)) // Theme Editor
}
async function buttonDisplayClearActive(ns) {
  if (ns.peek(2) !== "NULL PORT DATA" && ns.peek(2) > 0) await proxy(ns, "kill", ns.peek(2))// Puppet
  if (ns.peek(4) !== "NULL PORT DATA" && ns.peek(4) > 0) await proxy(ns, "kill", ns.peek(4))// Stocks
  if (ns.peek(5) !== "NULL PORT DATA" && ns.peek(5) > 0) await proxy(ns, "kill", ns.peek(5))// IPvGo
  if (ns.peek(6) !== "NULL PORT DATA" && ns.peek(6) > 0) await proxy(ns, "kill", ns.peek(6))// Gangs
  if (ns.peek(7) !== "NULL PORT DATA" && ns.peek(7) > 0) await proxy(ns, "kill", ns.peek(7))// Sleeves
  if (ns.peek(8) !== "NULL PORT DATA" && ns.peek(8) > 0) await proxy(ns, "kill", ns.peek(8))// BB
  if (ns.peek(9) !== "NULL PORT DATA" && ns.peek(9) > 0) await proxy(ns, "kill", ns.peek(9))// Corps
  if (ns.peek(10) !== "NULL PORT DATA" && ns.peek(10) > 0) await proxy(ns, "kill", ns.peek(10))// Casino
  if (ns.peek(20) !== "NULL PORT DATA" && ns.peek(20) > 0) await proxy(ns, "kill", ns.peek(20))// Grafting
  if (ns.peek(26) !== "NULL PORT DATA" && ns.peek(26) > 0) await proxy(ns, "writePort", 24, true)// Darknet Kill Switch
  if (ns.peek(27) !== "NULL PORT DATA" && ns.peek(27) > 0) await proxy(ns, "kill", ns.peek(27))// Minesweeper
  if (ns.peek(28) !== "NULL PORT DATA" && ns.peek(28) > 0) await proxy(ns, "kill", ns.peek(28))// Theme Editor
  if (ns.peek(29) !== "NULL PORT DATA" && ns.peek(29) > 0) await proxy(ns, "kill", ns.peek(29))// Timberman
  if (wnd?.tmrAutoInf) await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, []) //Stop it, Autoinfil
  if (optionsDB["ShareMode"]) {
    optionsDB["ShareMode"] = false
    await runIt(ns, "SphyxOS/bins/startShare.js", false, ["stop"])
  }
  ns.clearPort(2)// Puppet
  ns.clearPort(4)// Stocks
  ns.clearPort(5)// IPvGo
  ns.clearPort(6)// Gangs
  ns.clearPort(7)// Sleeves
  ns.clearPort(8)// BB
  ns.clearPort(9)// Corps
  ns.clearPort(10)//Casino
  ns.clearPort(11)//Stanek
  ns.clearPort(20)//Grafting
  ns.clearPort(24) //Clear the kill switch port.  Resolved promise still happens
  ns.clearPort(26)//Darknet
  ns.clearPort(27)//Minesweeper  
  ns.clearPort(28)//Theme Editor
  ns.clearPort(29)//Timberman

}
function buttonChangeLog(ns) {
  const updatePid = ns.exec("SphyxOS/bins/changeLog.js", "home")
  if (updatePid === 0) ns.tprintf("Error:  Not enough RAM to open change log.")
}
function buttonJoinDiscord(ns) {
  globalThis["window"]?.open?.(discordInviteUrl, "_blank", "noopener,noreferrer")
  ns.tprintf("Discord invite: %s", discordInviteUrl)
}
function buttonCreateGitHubIssue(ns) {
  globalThis["window"]?.open?.(gitHubIssueUrl, "_blank", "noopener,noreferrer")
  ns.tprintf("GitHub Issues Link: %s", gitHubIssueUrl)
}
function buildLoaderConfigPayload() {
  return {
    optionsDB: { ...optionsDB },
    openDB: [...openDB]
  }
}
function restoreLoaderConfig(payload) {
  optionsDB = { ...(payload?.optionsDB ?? {}) }
  openDB.clear()
  for (const key of payload?.openDB ?? []) {
    if (typeof key === "string")
      openDB.add(key)
  }
}
function saveLoaderConfig(ns) {
  ns.write(loaderConfigFile, JSON.stringify(buildLoaderConfigPayload()), "w")
  ns.scp(loaderConfigFile, "home")
}
async function loadLoaderConfig(ns) {
  if (ns.scp(loaderConfigFile, ns.self().server, "home")) {
    try {
      restoreLoaderConfig(JSON.parse(ns.read(loaderConfigFile)))
      await setOptionsDB(ns)
    }
    catch { await setOptionsDB(ns) }
  }
  else await setOptionsDB(ns)
}
async function buttonThemeEditorStart(ns) {
  if (ns.peek(28) !== "NULL PORT DATA") {
    ns.ui.openTail(ns.peek(28))
    await ns.asleep(0)
    ns.ui.resizeTail(640, 840, ns.peek(28))
  }
  else await runIt(ns, "SphyxOS/bins/themeEditor.jsx", false, [])
}
async function buttonDisplayRemove(ns) {
  return //Safety for myself
  const result = await ns.prompt("Are you sure?", { type: "boolean" })
  if (result === true) {
    const localStorage = !!await ns.prompt("Local Storage(Stanek loadouts, etc) too?", { type: "boolean" })
    ns.tprintf("Deleting SphyxOS.")
    await buttonDisplayClearActive(ns)
    await ns.asleep(4)
    writeRemoval(ns)
    await ns.asleep(4)
    const servers = await getServersLight(ns)
    const scriptRam = 2.8
    ns.tprintf("RAM: %s", scriptRam)
    for (const server of servers) {
      if (server === "home") continue
      const ram = await getServerAvailRam(ns, server)
      if (ram < scriptRam) continue
      ns.scp("SphyxOSRemoval.js", server)
      await ns.asleep(4)
      ns.exec("SphyxOSRemoval.js", server, 1, localStorage)
      await proxy(ns, "rm", "SphyxOSRemoval.js")
      ns.tprintf("Server: %s", server)
      ns.exit()
    }
    ns.toast("Not enough free RAM to run the removal script.", "error", 3000)
  }
}
/** @param {NS} ns */
function writeRemoval(ns) {
  const data = `
export async function main(ns) {
  const localRemoval = ns.args[0]
  ns.rm("SphyxOS.txt", "home")
  const files = ns.ls("home", "SphyxOS/")
  if (localRemoval) files.push(...ns.ls("home", "SphyxOSUserData/"))
  files.push("Loader.js")
  for (const file of files)
    ns.rm(file, "home")
}`
  ns.write("SphyxOSRemoval.js", data, "w")
}
async function buttonPopout(ns, program) {
  switch (program) {
    case "Batcher":
      optionsDB["BatcherPopout"] = !optionsDB["BatcherPopout"]
      if (ns.peek(2) !== "NULL PORT DATA")
        optionsDB["BatcherPopout"] === true ? ns.writePort(12, "popout") : ns.writePort(12, "nopopout")
      break
    case "AutoPilot":
      optionsDB["AutoPilotPopOut"] = !optionsDB["AutoPilotPopOut"]
      if (ns.peek(21) !== "NULL PORT DATA")
        ns.writePort(22, optionsDB["AutoPilotPopOut"] ? "popout" : "nopopout")
      break
    case "Stocks":
      optionsDB["StocksPopOut"] = !optionsDB["StocksPopOut"]
      if (ns.peek(4) !== "NULL PORT DATA")
        ns.writePort(13, optionsDB["StocksPopOut"] ? "popout" : "nopopout")
      break
    case "IPvGo":
      optionsDB["IPvGoPopOut"] = !optionsDB["IPvGoPopOut"]
      if (ns.peek(5) !== "NULL PORT DATA")
        ns.writePort(15, optionsDB["IPvGoPopOut"] ? "popout" : "nopopout")
      break
    case "BB":
      optionsDB["BBPopOut"] = !optionsDB["BBPopOut"]
      if (ns.peek(8) !== "NULL PORT DATA")
        ns.writePort(18, optionsDB["BBPopOut"] ? "popout" : "nopopout")
      break
    case "Gang":
      optionsDB["GangPopOut"] = !optionsDB["GangPopOut"]
      if (ns.peek(6) !== "NULL PORT DATA")
        ns.writePort(16, optionsDB["GangPopOut"] ? "popout" : "nopopout")
      break
    case "Grafting":
      optionsDB["GraftingPopOut"] = !optionsDB["GraftingPopOut"]
      if (ns.peek(20) !== "NULL PORT DATA")
        ns.writePort(23, optionsDB["GraftingPopOut"] ? "popout" : "nopopout")
      break
    case "Sleeve":
      optionsDB["SleevePopOut"] = !optionsDB["SleevePopOut"]
      if (ns.peek(7) !== "NULL PORT DATA")
        ns.writePort(17, optionsDB["SleevePopOut"] ? "popout" : "nopopout")
      break
    case "Corp":
      optionsDB["CorpPopOut"] = !optionsDB["CorpPopOut"]
      if (ns.peek(9) !== "NULL PORT DATA")
        ns.writePort(19, optionsDB["CorpPopOut"] ? "popout" : "nopopout")
      break
    default:
      ns.tprintf("Invalid program for popout: " + program)
      break
  }
}
async function buttonBatcherStart(ns) {
  if (ns.peek(2) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(2))
  }
  else {
    const commands = []
    if (optionsDB["BatcherUseHacknet"]) commands.push("usehacknet")
    if (optionsDB["BatcherAutoHash"]) commands.push("autohash")
    if (!optionsDB["BatcherAutoBuyServers"]) commands.push("nopurchase")
    if (optionsDB["BatcherAutoBuyHacknet"]) commands.push("autobuyhacknet")
    if (!optionsDB["BatcherMoney"]) commands.push("nomoney")
    if (!optionsDB["BatcherXP"]) commands.push("noxp")
    if (optionsDB["BatcherStanek"]) commands.push("stanek")
    ns.writePort(12, "silent")
    optionsDB["BatcherPopout"] === true ? ns.writePort(12, "popout") : ns.writePort(12, "nopopout")
    optionsDB["BatcherLog"] === true ? ns.writePort(12, "log") : ns.writePort(12, "nolog")
    optionsDB["BatcherPad"] === true ? ns.writePort(12, "pad") : ns.writePort(12, "nopad")
    await runIt(ns, "SphyxOS/bins/puppetMini.js", true, commands)
  }
}
function buttonBatcherAutoBuyServers(ns) {
  optionsDB["BatcherAutoBuyServers"] = !optionsDB["BatcherAutoBuyServers"]
  if (optionsDB["BatcherAutoBuyServers"] && ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, "purchaseservers")
  }
  else if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, "nopurchaseservers")
  }
}
function buttonBatcherUseHacknet(ns) {
  optionsDB["BatcherUseHacknet"] = !optionsDB["BatcherUseHacknet"]
  if (optionsDB["BatcherUseHacknet"] && ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, "hacknet")
  }
  else if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, "nohacknet")
  }
}
function buttonBatcherAutoHash(ns) {
  optionsDB["BatcherAutoHash"] = !optionsDB["BatcherAutoHash"]
  if (optionsDB["BatcherAutoHash"] && ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, "autohash")
  }
  else if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, "noautohash")
  }
}
function buttonBatcherAutoBuyHacknet(ns) {
  optionsDB["BatcherAutoBuyHacknet"] = !optionsDB["BatcherAutoBuyHacknet"]
  if (optionsDB["BatcherAutoBuyHacknet"] && ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, "autobuyhacknet")
  }
  else if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, "noautobuyhacknet")
  }
}
function buttonBatcherToggleMoney(ns) {
  optionsDB["BatcherMoney"] = !optionsDB["BatcherMoney"]
  if (!optionsDB["BatcherMoney"] && !optionsDB["BatcherXP"])
    optionsDB["BatcherMoney"] = true
  if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, optionsDB["BatcherMoney"] ? "money" : "nomoney")
  }
}
function buttonBatcherToggleXP(ns) {
  optionsDB["BatcherXP"] = !optionsDB["BatcherXP"]
  if (!optionsDB["BatcherMoney"] && !optionsDB["BatcherXP"]) {
    optionsDB["BatcherMoney"] = true
    if (ns.peek(2) !== "NULL PORT DATA") ns.writePort(12, "money")
  }
  if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, optionsDB["BatcherXP"] ? "xp" : "noxp")
  }
}
async function buttonBatcherToggleStanek(ns) {
  const frags = await proxy(ns, "stanek.activeFragments")
  if (frags.length === 0) {
    ns.toast("Please select a loadout first", "error", 3000)
    optionsDB["BatcherStanek"] = false
    return
  }
  optionsDB["BatcherStanek"] = !optionsDB["BatcherStanek"]
  if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, optionsDB["BatcherStanek"] ? "stanek" : "nostanek")
  }
}
async function buttonBatcherLog(ns) {
  optionsDB["BatcherLog"] = !optionsDB["BatcherLog"]
  if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, optionsDB["BatcherLog"] ? "log" : "nolog")
  }
}
async function buttonBatcherPad(ns) {
  optionsDB["BatcherPad"] = !optionsDB["BatcherPad"]
  if (ns.peek(2) !== "NULL PORT DATA") {
    ns.writePort(12, optionsDB["BatcherPad"] ? "pad" : "nopad")
  }
}
async function buttonHacknetBuyHacknet(ns) {
  await runIt(ns, "SphyxOS/bins/hacknetPurchaser.js", false, [])
}
async function buttonMiscBackdoorBasic(ns) {
  await runIt(ns, "SphyxOS/extras/crawl-Basic.js", true, [])
}
async function buttonMiscBackdoorSing(ns, all = false) {
  await runIt(ns, "SphyxOS/bins/singularityBackdoor.js", true, [all ? "all" : ""])
}
async function buttonMiscTeleport(ns) {
  await runIt(ns, "SphyxOS/extras/teleport.js", false, [])
}
async function buttonMiscSolveContracts(ns) {
  await runIt(ns, "SphyxOS/bins/codingContracts.js", false, [])
}
async function buttonMiscShareRam(ns) {
  optionsDB["ShareMode"] = !optionsDB["ShareMode"]
  if (optionsDB["ShareMode"]) await runIt(ns, "SphyxOS/bins/startShare.js", false, [])
  else await runIt(ns, "SphyxOS/bins/startShare.js", false, ["stop"])
}
async function buttonMiscKeepAlive(ns) {
  if (wnd.keepAlive) {
    wnd.keepAlive.close()
    delete wnd.keepAlive
  }
  else {
    const ctx = new AudioContext({ latencyHint: "playback" })
    const osc = ctx.createOscillator()
    // 1Hz - far too low to be audible
    osc.frequency.setValueAtTime(1, ctx.currentTime)
    const ctxGain = ctx.createGain()
    // This is just above the threshold where playback is considered "silent".
    ctxGain.gain.setValueAtTime(0.001, ctx.currentTime)
    // Have to avoid picking up the RAM cost of singularity.connect
    osc["connect"](ctxGain)
    ctxGain["connect"](ctx.destination)
    osc.start()
    wnd.keepAlive = ctx
  }
}
function buttonHashAutoTarget(target) {
  optionsDB["HashAutoTarget"] = normalizeHashAutoTarget(target)
}
async function buttonHashing(ns, mode) {
  const p = await runIt(ns, "SphyxOS/extras/hashIt.js", false, [mode])
  if (p > 0) await ns.nextPortWrite(p)
  ns.clearPort(p)
}
async function buttonStocksStart(ns) {
  if (ns.peek(4) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(4))
  }
  else {
    const commands = []
    if (optionsDB["StocksToggleAutoBuy"]) commands.push("autobuy")
    ns.writePort(13, "silent")
    ns.writePort(13, optionsDB["StocksPopOut"] ? "popout" : "nopopout")
    await runIt(ns, "SphyxOS/bins/tStocks.js", true, commands)
  }
}
function buttonStocksBuy(ns) {
  if (ns.peek(4) !== "NULL PORT DATA") ns.writePort(13, "buy")
}
function buttonStocksSell(ns) {
  if (ns.peek(4) !== "NULL PORT DATA") ns.writePort(13, "sell")
}
function buttonStocksToggleAutoBuy(ns) {
  optionsDB["StocksToggleAutoBuy"] = !optionsDB["StocksToggleAutoBuy"]
  if (optionsDB["StocksToggleAutoBuy"] && ns.peek(4) !== "NULL PORT DATA") {
    ns.writePort(13, "autobuy")
  }
  else if (ns.peek(4) !== "NULL PORT DATA") {
    ns.writePort(13, "autobuyoff")
  }
}
function buttonStocksReset(ns) {
  if (ns.peek(4) !== "NULL PORT DATA") {
    ns.writePort(13, "reset")
  }
}
async function buttonAutoPilot(ns) {
  if (ns.peek(21) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(21))
  }
  else {
    ns.writePort(22, "silent")
    ns.writePort(22, optionsDB["AutoPilotPopOut"] ? "popout" : "nopopout")
    ns.writePort(22, optionsDB["AutoPilotMoveOn"] ? "moveon" : "nomoveon")
    globalThis["document"].autopilot = optionsDB["AutoPilotMoveOn"]
    await runIt(ns, "SphyxOS/bins/autopilot.js", true, [])
  }
}
async function buttonAutoPilotMoveOn(ns) {
  optionsDB["AutoPilotMoveOn"] = !optionsDB["AutoPilotMoveOn"]
  if (ns.peek(21) !== "NULL PORT DATA") {
    globalThis["document"].autopilot = optionsDB["AutoPilotMoveOn"]
    ns.writePort(22, optionsDB["AutoPilotMoveOn"] ? "moveon" : "nomoveon")
  }
}
/** @param {NS} ns */
async function buttonDarknet(ns, mode, selectedStock = "") {
  const running = ns.peek(26) === "NULL PORT DATA" ? false : true
  if (mode === "start") {
    if (!await proxy(ns, "fileExists", "DarkscapeNavigator.exe", "home")) {
      ns.toast("Buy 'DarkscapeNavigator.exe' from the darkweb to start this.", "WARNING", 3000)
      return
    }
    if (running) {
      ns.writePort(24, true) //Kill port
      ns.clearPort(24) //Clear it after use.  The resolved promise still happens
      ns.clearPort(26)
    }
    else {
      ns.writePort(25, "silent")
      ns.writePort(25, optionsDB["DarknetPhishing"] ? "phishingOn" : "phishingOff")
      ns.writePort(25, optionsDB["DarknetInducing"] ? "inducingOn" : "inducingOff")
      ns.writePort(25, optionsDB["DarknetSharing"] ? "sharingOn" : "sharingOff")
      ns.writePort(25, optionsDB["DarknetShowMap"] ? "showmapOn" : "showmapOff")
      ns.writePort(25, optionsDB["DarknetStorm"] ? "stormOn" : "stormOff")
      ns.writePort(25, normalizeDarknetStockSelection(optionsDB["DarknetPromoteStock"]))
      await proxyAuth(ns, "darkweb", "", "scp", "SphyxOS/bins/darknet.jsx", "darkweb", "home")
      await proxyAuth(ns, "darkweb", "", "exec", "SphyxOS/bins/darknet.jsx", "darkweb")
    }
  }
  else if (mode === "phishing") {
    optionsDB["DarknetPhishing"] = !optionsDB["DarknetPhishing"]
    if (running) ns.writePort(25, optionsDB["DarknetPhishing"] ? "phishingOn" : "phishingOff")
  }
  else if (mode === "inducing") {
    optionsDB["DarknetInducing"] = !optionsDB["DarknetInducing"]
    if (running) ns.writePort(25, optionsDB["DarknetInducing"] ? "inducingOn" : "inducingOff")
  }
  else if (mode === "sharing") {
    optionsDB["DarknetSharing"] = !optionsDB["DarknetSharing"]
    if (running) ns.writePort(25, optionsDB["DarknetSharing"] ? "sharingOn" : "sharingOff")
  }
  else if (mode === "map") {
    optionsDB["DarknetShowMap"] = !optionsDB["DarknetShowMap"]
    if (running) ns.writePort(25, optionsDB["DarknetShowMap"] ? "showmapOn" : "showmapOff")
  }
  else if (mode === "storm") {
    optionsDB["DarknetStorm"] = !optionsDB["DarknetStorm"]
    if (running) ns.writePort(25, optionsDB["DarknetStorm"] ? "stormOn" : "stormOff")
  }
  else if (mode === "stock") {
    const stockSelection = normalizeDarknetStockSelection(selectedStock)
    optionsDB["DarknetPromoteStock"] = stockSelection
    if (running) ns.writePort(25, stockSelection)
  }
}
async function buttonIPvGoStart(ns) {
  if (ns.peek(5) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(5))
  }
  else {
    ns.writePort(15, "Silent")
    ns.writePort(15, optionsDB["IPvGoRepeat"] ? "Repeat On" : "Repeat Off")
    ns.writePort(15, optionsDB["IPvGoPlayAsWhite"] ? "Play as White On" : "Play as White Off")
    ns.writePort(15, optionsDB["IPvGoCheats"] ? "Cheats On" : "Cheats Off")
    ns.writePort(15, optionsDB["IPvGoLogging"] ? "Logging On" : "Logging Off")
    ns.writePort(15, optionsDB["IPvGoNetburners"] ? "Net On" : "Net Off")
    ns.writePort(15, optionsDB["IPvGoSlumSnakes"] ? "Slum On" : "Slum Off")
    ns.writePort(15, optionsDB["IPvGoTheBlackHand"] ? "BH On" : "BH Off")
    ns.writePort(15, optionsDB["IPvGoTetrads"] ? "Tetrad On" : "Tetrad Off")
    ns.writePort(15, optionsDB["IPvGoDaedalus"] ? "Daed On" : "Daed Off")
    ns.writePort(15, optionsDB["IPvGoIlluminati"] ? "Illum On" : "Illum Off")
    ns.writePort(15, optionsDB["IPvGoUnknown"] ? "???? On" : "???? Off")
    ns.writePort(15, optionsDB["IPvGoNoAI"] ? "No AI On" : "No AI Off")
    await runIt(ns, "SphyxOS/bins/go.js", true, [])
  }
}
function buttonIPvGoPlayWhite(ns) {
  optionsDB["IPvGoPlayAsWhite"] = !optionsDB["IPvGoPlayAsWhite"]
  if (!optionsDB["IPvGoPlayAsWhite"]) {
    if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, "Play as White Off")
  }
  else {
    optionsDB["IPvGoNoAI"] = true
    if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, "Play as White On")
    if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, "No AI On")
  }
}
function buttonIPvGoRepeat(ns) {
  optionsDB["IPvGoRepeat"] = !optionsDB["IPvGoRepeat"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoRepeat"] ? "Repeat On" : "Repeat Off")
}
function buttonIPvGoCheats(ns) {
  optionsDB["IPvGoCheats"] = !optionsDB["IPvGoCheats"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoCheats"] ? "Cheats On" : "Cheats Off")
}
function buttonIPvGoLogging(ns) {
  optionsDB["IPvGoLogging"] = !optionsDB["IPvGoLogging"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoLogging"] ? "Logging On" : "Logging Off")
}
function buttonIPvGoNetburners(ns) {
  optionsDB["IPvGoNetburners"] = !optionsDB["IPvGoNetburners"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoNetburners"] ? "Net On" : "Net Off")
}
function buttonIPvGoSlumSnakes(ns) {
  optionsDB["IPvGoSlumSnakes"] = !optionsDB["IPvGoSlumSnakes"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoSlumSnakes"] ? "Slum On" : "Slum Off")
}
function buttonIPvGoTheBlackHand(ns) {
  optionsDB["IPvGoTheBlackHand"] = !optionsDB["IPvGoTheBlackHand"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoTheBlackHand"] ? "BH On" : "BH Off")
}
function buttonIPvGoTetrads(ns) {
  optionsDB["IPvGoTetrads"] = !optionsDB["IPvGoTetrads"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoTetrads"] ? "Tetrad On" : "Tetrad Off")
}
function buttonIPvGoDaedalus(ns) {
  optionsDB["IPvGoDaedalus"] = !optionsDB["IPvGoDaedalus"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoDaedalus"] ? "Daed On" : "Daed Off")
}
function buttonIPvGoIlluminati(ns) {
  optionsDB["IPvGoIlluminati"] = !optionsDB["IPvGoIlluminati"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoIlluminati"] ? "Illum On" : "Illum Off")
}
function buttonIPvGoUnknown(ns) {
  optionsDB["IPvGoUnknown"] = !optionsDB["IPvGoUnknown"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoUnknown"] ? "???? On" : "???? Off")
}
function buttonIPvGoNoAI(ns) {
  optionsDB["IPvGoNoAI"] = !optionsDB["IPvGoNoAI"]
  if (!optionsDB["IPvGoNoAI"]) {
    optionsDB["IPvGoPlayAsWhite"] = false
    if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, "Play as White Off")
    if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, "No AI Off")
  }
  else {
    if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoPlayAsWhite"] ? "Play as White On" : "Play as White Off")
    if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, "No AI On")
  }
}
function buttonIPvGoSlowMode(ns) {
  optionsDB["IPvGoSlowMode"] = !optionsDB["IPvGoSlowMode"]
  if (ns.peek(5) !== "NULL PORT DATA") ns.writePort(15, optionsDB["IPvGoSlowMode"] ? "SlowMode On" : "SlowMode Off")
}
async function buttonGangStart(ns) {
  if (ns.peek(6) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(6))
  }
  else {
    ns.writePort(16, "Silent")
    ns.writePort(16, optionsDB["GangAutoAscend"] ? "AutoAscend On" : "AutoAscend Off")
    ns.writePort(16, optionsDB["GangAutoEQ"] ? "AutoEQ On" : "AutoEQ Off")
    ns.writePort(16, optionsDB["GangMode"])
    ns.writePort(16, optionsDB["SleeveMode"] === "Gangs" ? "Sleeves On" : "Sleeves Off")
    const port = await runIt(ns, "SphyxOS/bins/gang.js", true, [])
    if (port) ns.writePort(6, port)
  }
}
function buttonGangAutoAscend(ns) {
  optionsDB["GangAutoAscend"] = !optionsDB["GangAutoAscend"]
  ns.writePort(16, optionsDB["GangAutoAscend"] ? "AutoAscend On" : "AutoAscend Off")
}
function buttonGangAutoEQ(ns) {
  optionsDB["GangAutoEQ"] = !optionsDB["GangAutoEQ"]
  ns.writePort(16, optionsDB["GangAutoEQ"] ? "AutoEQ On" : "AutoEQ Off")
}
function buttonGangMode(ns, mode) {
  optionsDB["GangMode"] = mode
  if (ns.peek(6) !== "NULL PORT DATA")
    ns.writePort(16, optionsDB["GangMode"])
}
function buttonGangBuyEQ(ns) {
  if (ns.peek(6) !== "NULL PORT DATA") ns.writePort(16, "Buy EQ")
}
function buttonGangAscend(ns) {
  if (ns.peek(6) !== "NULL PORT DATA") ns.writePort(16, "Ascend")
}
async function buttonCorpStart(ns) {
  if (ns.peek(9) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(9))
  }
  else {
    ns.writePort(19, "Silent")
    ns.writePort(19, optionsDB["CorpPopOut"] ? "popout" : "nopopout")
    await runIt(ns, "SphyxOS/bins/corp.js", true, [])
  }
}
function buttonCorpResetTAII(ns) {
  if (ns.peek(9) !== "NULL PORT DATA") ns.writePort(19, "Reset TAII")
}
async function buttonCorpBribe(ns) {
  const player = await proxy(ns, "getPlayer")
  if (player.factions.length === 0) return
  const corp = await proxy(ns, "corporation.getCorporation")
  if (corp && corp.valuation >= 100000000000000) {
    const faction = await ns.prompt("Choose a faction to bribe:", { type: "select", choices: player.factions })
    if (faction === "") return
    await proxy(ns, "corporation.bribe", faction, corp.funds / 100)
    ns.tprintf("Corp: Attempted to bribe: %s", faction)
  }
}
async function buttonSingDumpMoney(ns) {
  await runIt(ns, "SphyxOS/bins/dumpMoney.js", false, [])
}
async function buttonSleeveStart(ns) {
  if (ns.peek(7) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(7))
  }
  else {
    ns.writePort(17, "Silent")
    ns.writePort(17, optionsDB["SleeveMode"])
    ns.writePort(17, optionsDB["SleeveInstall"] ? "Install On" : "Install Off")
    await runIt(ns, "SphyxOS/bins/tSleeves.js", true, [])
  }
}
function buttonSleevesInstallAugments(ns) {
  optionsDB["SleeveInstall"] = !optionsDB["SleeveInstall"]
  if (ns.peek(7) !== "NULL PORT DATA") ns.writePort(17, optionsDB["SleeveInstall"] ? "Install On" : "Install Off")
}
async function buttonSleevesToggle(ns, mode) {
  mode = normalizeSleeveToggleMode(mode)
  switch (mode) {//optionsDB["SleeveMode"]) { // Turn off the one that's on since it's changing
    case "Gangs":
      if (ns.peek(6) !== "NULL PORT DATA") ns.writePort(16, "Sleeves Off")
      break
    case "BB":
      if (ns.peek(8) !== "NULL PORT DATA") ns.writePort(18, "sleeves off")
      break
    case "All":
    case "Hack":
    case "Str":
    case "Def":
    case "Dex":
    case "Agi":
    case "Cha":
    case "Recovery":
    case "Sync":
    case "Money":
    case "Karma":
    case "Idle":
    case "Int":
      if (ns.peek(7) !== "NULL PORT DATA"
        && !sleeveLocalModes.includes(mode)) await proxy(ns, "kill", ns.peek(7))
      break

    default:
      ns.tprintf("Invalid Sleeve mode: %s", optionsDB["SleeveMode"])
  }
  const numSleeves = await proxy(ns, "sleeve.getNumSleeves")
  if (optionsDB["SleeveMode"] === mode || mode === "Idle") { //turn it off and set to idle if it's the same one
    //Switch all sleeves to idle
    for (let slv = 0; slv < numSleeves; slv++)
      await proxy(ns, "sleeve.setToIdle", slv)
    if (optionsDB["SleeveMode"] !== "Idle" && mode === "Idle" && ns.peek(7) !== "NULL PORT DATA")
      ns.writePort(17, mode)
    optionsDB["SleeveMode"] = "Idle"
  }
  else {
    switch (mode) { // Turn on the new one
      case "Gangs":
        if (ns.peek(6) !== "NULL PORT DATA") ns.writePort(16, "Sleeves On")
        break
      case "BB":
        if (ns.peek(8) !== "NULL PORT DATA") ns.writePort(18, "sleeves on")
        break
      case "All":
      case "Hack":
      case "Str":
      case "Def":
      case "Dex":
      case "Agi":
      case "Cha":
      case "Recovery":
      case "Sync":
      case "Money":
      case "Karma":
      case "Int":
        if (ns.peek(7) !== "NULL PORT DATA")
          ns.writePort(17, mode)
        break
      case "Idle":
        for (let i = 0; i < numSleeves; i++)
          await proxy(ns, "sleeve.setToIdle", i)
        break
      default:
        ns.tprintf("Invalid Sleeve mode: %s", mode)
    }
    optionsDB["SleeveMode"] = mode
  }
}
async function buttonGrafting(ns) {
  if (ns.peek(20) !== "NULL PORT DATA") await proxy(ns, "kill", ns.peek(20))
  else {
    resetInfo = await getResetInf(ns)
    sourceFiles = await getOwnedSF(ns)
    const hasSing = hasBN(resetInfo, sourceFiles, 4, 2)
    if (hasSing) await runIt(ns, "SphyxOS/bins/graftingAdv.js", true, [])
    else await runIt(ns, "SphyxOS/bins/graftingBasic.js", true, [])
  }
}
async function buttonBBStart(ns) {
  if (ns.peek(8) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(8))
  }
  else {
    ns.writePort(18, "quiet")
    ns.writePort(18, optionsDB["BBFinisher"] ? "finisher on" : "finisher off")
    ns.writePort(18, optionsDB["BBIntMode"] ? "int mode on" : "int mode off")
    ns.writePort(18, optionsDB["SleeveMode"] === "BB" ? "sleeves on" : "sleeves off")
    ns.writePort(18, optionsDB["BBInfilOnly"] ? "sleeve infil on" : "sleeve infil off")
    const value = await runIt(ns, "SphyxOS/bins/bb.js", true, [])
    if (value > 0) ns.writePort(8, value)
  }
}
function buttonBBFinisher(ns) {
  optionsDB["BBFinisher"] = !optionsDB["BBFinisher"]
  if (ns.peek(8) !== "NULL PORT DATA") ns.writePort(18, optionsDB["BBFinisher"] ? "finisher on" : "finisher off")
}
function buttonBBIntMode(ns) {
  optionsDB["BBIntMode"] = !optionsDB["BBIntMode"]
  if (ns.peek(8) !== "NULL PORT DATA") ns.writePort(18, optionsDB["BBIntMode"] ? "int mode on" : "int mode off")
}
function buttonBBInfilOnly(ns) {
  optionsDB["BBInfilOnly"] = !optionsDB["BBInfilOnly"]
  if (ns.peek(8) !== "NULL PORT DATA") ns.writePort(18, optionsDB["BBInfilOnly"] ? "sleeve infil on" : "sleeve infil off")
}
/** @param {NS} ns */
async function buttonStanekStart(ns) {
  if (ns.peek(11) === "NULL PORT DATA") {
    const frags = await proxy(ns, "stanek.activeFragments")

    if (frags?.length > 0) {
      const val = await runIt(ns, "SphyxOS/stanek/startCharge.js", true, [])
      if (val > 0) ns.writePort(11, val)
    }
    else ns.toast("Please select a loadout first", "error", 3000)
  }
}
async function buttonStanekSaveConfig(ns) {
  ns.exec("SphyxOS/stanek/saveStanek.js", "home", 1)
}
async function buttonStanekDeleteConfig(ns) {
  ns.exec("SphyxOS/stanek/deleteStanek.js", "home", 1)
}
function buttonStanekLoadConfig(ns) {
  if (optionsDB["StanekDefault"])
    ns.exec("SphyxOS/stanek/loadStanek.js", "home", 1, "default")
  else
    ns.exec("SphyxOS/stanek/loadStanek.js", "home", 1)
}
function buttonStanekUseDefault(ns) {
  optionsDB["StanekDefault"] = !optionsDB["StanekDefault"]
}
async function buttonGameMinesweeper(ns) {
  if (ns.peek(27) === "NULL PORT DATA")
    await runIt(ns, "SphyxOS/games/minesweeper.jsx", false, []) //Games will use up home ram so they can always run
}
async function buttonGameDoom(ns) {
  await runIt(ns, "SphyxOS/games/doom.jsx", false, []) //Games will use up home ram so they can always run
}
async function buttonGameTimberman(ns) {
  if (ns.peek(29) === "NULL PORT DATA")
    await runIt(ns, "SphyxOS/games/timberman.js", false, []) //Games will use up home ram so they can always run
}
async function buttonDevMenu(ns) {
  await runIt(ns, "SphyxOS/cheats/devMenu.js", false, [])
}
async function buttonNotDevMenu(ns) {
  await runIt(ns, "SphyxOS/cheats/notTheDevMenu.jsx", false, [])
}
async function buttonUnlockAll(ns) {
  const result = await ns.prompt("Are you sure?", { type: "boolean" })
  if (!result || result === "") return
  await runIt(ns, "SphyxOS/cheats/achievements.js", false, [])
}
async function buttonCasinoStart(ns) {
  if (ns.peek(10) !== "NULL PORT DATA") {
    await proxy(ns, "kill", ns.peek(10))
  }
  else {
    await runIt(ns, "SphyxOS/cheats/casino.js", true, [])
  }
}
async function buttonAutoInfilStart(ns) {
  if (wnd.tmrAutoInf) { //Stop it
    await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, [])
    ns.clearPort(30)
  }
  else { //Start it
    if (!optionsDB["AutoInfilAuto"]) ns.writePort(30, await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, []))
    else if (optionsDB["AutoInfilMoneyMode"]) ns.writePort(30, await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, ["--auto"]))
    else ns.writePort(30, await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, ["--auto", "--faction", optionsDB["AutoInfilFaction"]]))
  }
}
async function buttonAutoInfilAuto(ns) {
  optionsDB["AutoInfilAuto"] = !optionsDB["AutoInfilAuto"]
  if (!optionsDB["AutoInfilAuto"]) { //Turn it off
    optionsDB["AutoInfilFaction"] = ""
    optionsDB["AutoInfilMoneyMode"] = false
    if (wnd.tmrAutoInf) await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, ["--update", "--quiet"])
  }
  else { //Turn it on
    optionsDB["AutoInfilMoneyMode"] = true
    optionsDB["AutoInfilFaction"] = ""
    if (wnd.tmrAutoInf) await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, ["--auto", "--update", "--quiet"])
  }
}
async function buttonAutoInfilMoney(ns) {
  optionsDB["AutoInfilMoneyMode"] = !optionsDB["AutoInfilMoneyMode"]
  if (optionsDB["AutoInfilMoneyMode"]) { //Already on, just abort
    return
  }
  else { //Turn it on
    optionsDB["AutoInfilAuto"] = true
    optionsDB["AutoInfilMoneyMode"] = true
    optionsDB["AutoInfilFaction"] = ""
    optionsDB["AutoInfilFactionMode"] = false
    if (wnd.tmrAutoInf) await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, ["--auto", "--update", "--quiet"])
  }
}
async function buttonAutoInfilFaction(ns) {
  const player = await proxy(ns, "getPlayer")
  let gangFac = ""
  const mygang = await proxy(ns, "gang.getGangInformation")
  if (mygang) gangFac = mygang.faction

  const factions = player.factions.filter((f) => ![gangFac, "Bladeburners", "Church of the Machine God", "Shadows of Anarchy"].includes(f))
  if (factions.length === 0) {
    optionsDB["AutoInfilMoneyMode"] = true
    optionsDB["AutoInfilFactionMode"] = false
    return
  }
  else if (factions.length > 1)
    optionsDB["AutoInfilFaction"] = await ns.prompt("Select Faction", { type: "select", choices: factions })
  else
    optionsDB["AutoInfilFaction"] = factions.pop()

  if (optionsDB["AutoInfilFaction"] === "") {
    optionsDB["AutoInfilMoneyMode"] = true
    optionsDB["AutoInfilFactionMode"] = false
    return
  }
  optionsDB["AutoInfilAuto"] = true
  optionsDB["AutoInfilMoneyMode"] = false
  optionsDB["AutoInfilFactionMode"] = true
  if (wnd.tmrAutoInf) await runIt(ns, "SphyxOS/cheats/autoInfil.js", false, ["--auto", "--faction", optionsDB["AutoInfilFaction"], "--update", "--quiet"])
}
/** @param {NS} ns */
async function setOptionsDB(ns) {
  if (optionsDB["BatcherUseHacknet"] === undefined)
    optionsDB["BatcherUseHacknet"] = false
  if (optionsDB["BatcherAutoHash"] === undefined)
    optionsDB["BatcherAutoHash"] = false
  if (optionsDB["BatcherAutoBuyServers"] === undefined)
    optionsDB["BatcherAutoBuyServers"] = true
  if (optionsDB["BatcherAutoBuyHacknet"] === undefined)
    optionsDB["BatcherAutoBuyHacknet"] = false
  if (optionsDB["BatcherMoney"] === undefined)
    optionsDB["BatcherMoney"] = true
  if (optionsDB["BatcherXP"] === undefined)
    optionsDB["BatcherXP"] = true
  if (optionsDB["BatcherStanek"] === undefined)
    optionsDB["BatcherStanek"] = false
  if (optionsDB["BatcherPad"] === undefined)
    optionsDB["BatcherPad"] = false
  if (optionsDB["BatcherLog"] === undefined)
    optionsDB["BatcherLog"] = false
  if (optionsDB["BatcherPopout"] === undefined)
    optionsDB["BatcherPopout"] = false
  if (optionsDB["DisplayToggleHelper"] === undefined)
    optionsDB["DisplayToggleHelper"] = true
  if (optionsDB["DisplayToggleAutoUpdate"] === undefined)
    optionsDB["DisplayToggleAutoUpdate"] = true
  if (optionsDB["DisplayToggleUpdateVersion"] === undefined)
    optionsDB["DisplayToggleUpdateVersion"] = "Stable"
  if (optionsDB["DisplayViewMode"] === undefined)
    optionsDB["DisplayViewMode"] = "Mini"
  if (!Array.isArray(optionsDB["MiniSelectedRows"]))
    optionsDB["MiniSelectedRows"] = []
  if (optionsDB["StocksToggleAutoBuy"] === undefined)
    optionsDB["StocksToggleAutoBuy"] = false
  if (optionsDB["StocksPopOut"] === undefined)
    optionsDB["StocksPopOut"] = false
  if (optionsDB["DarknetPhishing"] === undefined)
    optionsDB["DarknetPhishing"] = true
  if (optionsDB["DarknetInducing"] === undefined)
    optionsDB["DarknetInducing"] = false
  if (optionsDB["DarknetSharing"] === undefined)
    optionsDB["DarknetSharing"] = true
  if (optionsDB["DarknetShowMap"] === undefined)
    optionsDB["DarknetShowMap"] = true
  if (optionsDB["DarknetStorm"] === undefined)
    optionsDB["DarknetStorm"] = false
  if (optionsDB["DarknetPromoteStock"] === undefined)
    optionsDB["DarknetPromoteStock"] = buildDarknetStockSelection()
  else
    optionsDB["DarknetPromoteStock"] = normalizeDarknetStockSelection(optionsDB["DarknetPromoteStock"])
  if (optionsDB["IPvGoPlayAsWhite"] === undefined)
    optionsDB["IPvGoPlayAsWhite"] = false
  if (optionsDB["IPvGoRepeat"] === undefined)
    optionsDB["IPvGoRepeat"] = true
  if (optionsDB["IPvGoCheats"] === undefined)
    optionsDB["IPvGoCheats"] = true
  if (optionsDB["IPvGoLogging"] === undefined)
    optionsDB["IPvGoLogging"] = false
  if (optionsDB["IPvGoNetburners"] === undefined)
    optionsDB["IPvGoNetburners"] = true
  if (optionsDB["IPvGoSlumSnakes"] === undefined)
    optionsDB["IPvGoSlumSnakes"] = true
  if (optionsDB["IPvGoTheBlackHand"] === undefined)
    optionsDB["IPvGoTheBlackHand"] = true
  if (optionsDB["IPvGoTetrads"] === undefined)
    optionsDB["IPvGoTetrads"] = true
  if (optionsDB["IPvGoDaedalus"] === undefined)
    optionsDB["IPvGoDaedalus"] = true
  if (optionsDB["IPvGoIlluminati"] === undefined)
    optionsDB["IPvGoIlluminati"] = true
  if (optionsDB["IPvGoUnknown"] === undefined)
    optionsDB["IPvGoUnknown"] = true
  if (optionsDB["IPvGoNoAI"] === undefined)
    optionsDB["IPvGoNoAI"] = false
  if (optionsDB["IPvGoSlowMode"] === undefined)
    optionsDB["IPvGoSlowMode"] = false
  if (optionsDB["IPvGoPopOut"] === undefined)
    optionsDB["IPvGoPopOut"] = false
  if (optionsDB["GangAutoAscend"] === undefined)
    optionsDB["GangAutoAscend"] = true
  if (optionsDB["GangAutoEQ"] === undefined)
    optionsDB["GangAutoEQ"] = true
  if (optionsDB["GangMode"] === undefined)
    optionsDB["GangMode"] = "AutoMode"
  if (optionsDB["GangPopOut"] === undefined)
    optionsDB["GangPopOut"] = false
  if (optionsDB["CorpPopOut"] === undefined)
    optionsDB["CorpPopOut"] = false
  if (optionsDB["SleeveMode"] === undefined) {
    if (hasBN(resetInfo, sourceFiles, 10, 1)) {
      const slvs = await proxy(ns, "sleeve.getNumSleeves")
      if (slvs)
        for (let i = 0; i < slvs; i++)
          await proxy(ns, "sleeve.setToIdle", i)
      optionsDB["SleeveMode"] = "Idle"
      if (optionsDB["SleeveInstall"] === undefined)
        optionsDB["SleeveInstall"] = false
      if (optionsDB["SleevePopOut"] === undefined)
        optionsDB["SleevePopOut"] = false
    }
  }
  if (optionsDB["BBFinisher"] === undefined)
    optionsDB["BBFinisher"] = false
  if (optionsDB["BBIntMode"] === undefined)
    optionsDB["BBIntMode"] = false
  if (optionsDB["BBInfilOnly"] === undefined)
    optionsDB["BBInfilOnly"] = false
  if (optionsDB["BBPopOut"] === undefined)
    optionsDB["BBPopOut"] = false
  if (optionsDB["AutoInfilAuto"] === undefined)
    optionsDB["AutoInfilAuto"] = true
  if (optionsDB["AutoInfilMoneyMode"] === undefined)
    optionsDB["AutoInfilMoneyMode"] = true
  if (optionsDB["AutoInfilFactionMode"] === undefined)
    optionsDB["AutoInfilFactionMode"] = false
  if (optionsDB["AutoInfilFaction"] === undefined)
    optionsDB["AutoInfilFaction"] = ""
  if (optionsDB["ShareMode"] === undefined)
    optionsDB["ShareMode"] = false
  if (optionsDB["StanekDefault"] === undefined)
    optionsDB["StanekDefault"] = true
  if (optionsDB["AutoPilotMoveOn"] === undefined)
    optionsDB["AutoPilotMoveOn"] = false
  if (optionsDB["AutoPilotPopOut"] === undefined)
    optionsDB["AutoPilotPopOut"] = false
  if (optionsDB["GraftingPopOut"] === undefined)
    optionsDB["GraftingPopOut"] = false
  optionsDB["HashAutoTarget"] = normalizeHashAutoTarget(optionsDB["HashAutoTarget"])
}
function hasBN(resetInfo, sourceFiles, bn, sfLvl = 1) {
  if (resetInfo.currentNode === bn) return true
  try {
    for (const sf of sourceFiles) if (sf.n === bn && sf.lvl >= sfLvl) return true
    return false
  }
  catch { return false }
}
function normalizeRowContent(node) {
  const React = getReactLib()
  if (!React || node === null || node === undefined || typeof node === "boolean")
    return node
  if (typeof node === "string" || typeof node === "number")
    return node
  if (!React.isValidElement(node))
    return node
  const childProps = node.props ?? {}
  const normalizedChildren = React.Children.map(childProps.children, (child) => normalizeRowContent(child))
  if (typeof node.type === "string" && node.type.toLowerCase() === "button") {
    return React.cloneElement(node, {
      ...childProps,
      style: { ...rowButtonBaseStyle, ...(childProps.style ?? {}) }
    }, normalizedChildren)
  }
  return React.cloneElement(node, childProps, normalizedChildren)
}
function Row({ title, buttons, onHideToggle }) {
  const normalizedButtons = normalizeRowContent(buttons)
  const hideToggle = <input
    type="checkbox"
    checked={true}
    title={"Uncheck to hide " + title}
    style={rowHideCheckboxStyle}
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
    onChange={() => onHideToggle(title)}
  />
  const titleWithHide = <span>{title}{hideToggle}</span>
  if (openDB.has(title))
    return (
      <div data-row={title}>
        <details open onToggle={(e) => {
          if (e.currentTarget.open)
            openDB.add(title)
          else
            openDB.delete(title)
        }}>
          <summary style={{ fontSize: 18 }}>{titleWithHide}</summary>
          <div style={rowBodyStyle}>{normalizedButtons}</div>
        </details>
      </div>
    )
  else
    return (
      <div data-row={title}>
        <details onToggle={(e) => {
          if (e.currentTarget.open)
            openDB.add(title)
          else
            openDB.delete(title)
        }}>
          <summary style={{ fontSize: 18 }}>{titleWithHide}</summary>
          <div style={rowBodyStyle}>{normalizedButtons}</div>
        </details>

      </div >
    )
}
function MiniView({ rows, selectedRows, onToggleRow, onHideToggle, onMiniRowContextHide, rowVisibilityVersion }) {
  const openRows = rows.filter((row) => selectedRows.includes(row[0].toString()))
  if (rows.length === 0)
    return <div style={miniEmptyStateStyle}>{"No rows are currently available in Mini view."}</div>
  return (
    <div>
      <div style={miniHintStyle}>{"Left Click to enable.  Right Click to hide."}</div>
      <div style={miniRowSelectorWrapStyle}>
        {rows.map((row) => <button key={row[0]} data-nohover="true" style={selectedRows.includes(row[0].toString()) ? miniRowSelectorActiveStyle : miniRowSelectorButtonStyle} onClick={() => onToggleRow(row[0].toString())} onContextMenu={(event) => {
          event.preventDefault()
          onMiniRowContextHide(row[0].toString())
        }}>{row[0]}</button>)}
      </div>
      {openRows.length === 0
        ? <div style={miniEmptyStateStyle}>{"Select one or more rows above to show them here."}</div>
        : openRows.map((row) => <MiniRowPanel key={row[0] + "-" + rowVisibilityVersion} title={row[0].toString()} buttons={row[3]} onHideToggle={onHideToggle}></MiniRowPanel>)}
    </div>
  )
}
function MiniRowPanel({ title, buttons, onHideToggle }) {
  const normalizedButtons = normalizeRowContent(buttons)
  return (
    <div data-row={title} style={miniRowPanelStyle}>
      <div style={miniRowPanelHeaderStyle}>
        <div style={miniRowTitleWrapStyle}>
          <div style={miniRowPanelTitleStyle}>{title}</div>
          <label style={miniRowHideWrapStyle}>
            <input type="checkbox" checked={true} style={miniRowHideCheckboxStyle} onChange={() => onHideToggle(title)} />
            {"Visible"}
          </label>
        </div>
      </div>
      <div style={rowBodyStyle}>{normalizedButtons}</div>
    </div>
  )
}
const greenStyle = {
  backgroundColor: "var(--bb-theme-primarydark)",
  color: "var(--bb-theme-backgroundprimary)"
}
const redStyle = {
  backgroundColor: "var(--bb-theme-error)",
  color: "var(--bb-theme-backgroundprimary)"
}
const rowHideCheckboxStyle = {
  marginLeft: 8,
  verticalAlign: "middle"
}
const rowBodyStyle = {
  paddingTop: 6,
  paddingBottom: 2
}
const rowButtonBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 74,
  height: 28,
  padding: "2px 6px",
  marginRight: 4,
  marginBottom: 4,
  borderRadius: 4,
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  textAlign: "center",
  whiteSpace: "normal",
  fontSize: 12,
  lineHeight: 1.05,
  overflow: "hidden",
  verticalAlign: "middle"
}
const alwaysOnStyle = {
  backgroundColor: "var(--bb-theme-cha)",
  color: "var(--bb-theme-backgroundprimary)"
}
const topPanelWrapStyle = {
  position: "relative",
  marginBottom: 10,
  padding: "10px 12px 12px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))"
}
const topPanelInfoStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10
}
const topPanelTitleStyle = {
  fontSize: 18,
  fontWeight: "bold",
  letterSpacing: "0.02em"
}
const topPanelMetaStyle = {
  opacity: 0.8,
  fontSize: 12,
  lineHeight: 1.3
}
const displayStatusTrayStyle = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap"
}
const displayStatusBaseStyle = {
  appearance: "none",
  cursor: "pointer",
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: "bold",
  border: "1px solid rgba(255,255,255,0.12)"
}
const displayStatusOnStyle = {
  ...displayStatusBaseStyle,
  backgroundColor: "var(--bb-theme-infodark)",
  color: "var(--bb-theme-secondarylight)"
}
const displayStatusOffStyle = {
  ...displayStatusBaseStyle,
  backgroundColor: "var(--bb-theme-errordark)",
  color: "var(--bb-theme-secondarylight)"
}
const displayStatusWarnStyle = {
  ...displayStatusBaseStyle,
  backgroundColor: "rgba(200, 143, 31, 0.38)", //Burnt orange
  color: "var(--bb-theme-secondarylight)"
}
const displayStatusMutedStyle = {
  ...displayStatusBaseStyle,
  backgroundColor: "var(--bb-theme-infodark)",
  color: "var(--bb-theme-secondarylight)"
}
const displayThemeEditorStyle = {
  ...displayStatusBaseStyle,
  ...alwaysOnStyle
}
const toolbarBarStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  paddingTop: 8,
  borderTop: "1px solid rgba(255,255,255,0.08)"
}
const viewModeToggleWrapStyle = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  padding: 3,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)"
}
const viewModeLabelStyle = {
  fontSize: 12,
  fontWeight: "bold",
  opacity: 0.82,
  paddingLeft: 4
}
const viewModeButtonStyle = {
  appearance: "none",
  cursor: "pointer",
  borderRadius: 6,
  padding: "7px 12px",
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "var(--bb-theme-primary)",
  fontWeight: "bold"
}
const viewModeButtonActiveStyle = {
  ...viewModeButtonStyle,
  backgroundColor: "var(--bb-theme-primarydark)",
  color: "var(--bb-theme-backgroundprimary)"
}
const viewModeMiniActiveStyle = {
  ...viewModeButtonStyle,
  backgroundColor: "var(--bb-theme-cha)",
  color: "var(--bb-theme-backgroundprimary)"
}
const toolbarMenuStyle = {
  position: "relative"
}
const toolbarSummaryStyle = {
  appearance: "none",
  listStyle: "none",
  cursor: "pointer",
  userSelect: "none",
  borderRadius: 6,
  padding: "7px 12px",
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "var(--bb-theme-secondarylight)",
  fontWeight: "bold"
}
const toolbarSummaryOpenStyle = {
  ...toolbarSummaryStyle,
  backgroundColor: "var(--bb-theme-info)",
  border: "1px solid rgba(138, 180, 255, 0.38)"
}
const toolbarDropdownStyle = {
  position: "absolute",
  top: "50%",
  left: "calc(100% + 4px)",
  transform: "translateY(-50%)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(10, 12, 18, 0.96)",
  boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
  zIndex: 40,
  maxHeight: 360,
  overflowY: "auto"
}
const toolbarSectionTitleStyle = {
  fontSize: 11,
  fontWeight: "bold",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  opacity: 0.72
}
const toolbarHintStyle = {
  fontSize: 12,
  opacity: 0.72,
  paddingLeft: 4
}
const displayButtonBaseStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  borderRadius: 6,
  padding: "6px 10px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)"
}
const miniRowSelectorWrapStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginBottom: 4,
  padding: "4px 6px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))"
}
const miniHintStyle = {
  fontSize: 11,
  fontWeight: "bold",
  opacity: 0.72,
  marginBottom: 2,
  paddingLeft: 2,
  lineHeight: 1.1
}
const miniRowSelectorButtonStyle = {
  appearance: "none",
  cursor: "pointer",
  borderRadius: 999,
  padding: "3px 9px",
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "rgba(255,255,255,0.05)",
  color: "var(--bb-theme-primary)",
  fontSize: 11,
  fontWeight: "bold"
}
const miniRowSelectorActiveStyle = {
  ...miniRowSelectorButtonStyle,
  backgroundColor: "var(--bb-theme-primarydark)",
  color: "var(--bb-theme-backgroundprimary)"
}
const miniRowPanelStyle = {
  marginBottom: 2,
  padding: 0,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))"
}
const miniRowPanelHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 4,
  flexWrap: "wrap"
}
const miniRowTitleWrapStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap"
}
const miniRowPanelTitleStyle = {
  fontSize: 15,
  fontWeight: "bold"
}
const miniRowHideWrapStyle = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 11,
  opacity: 0.85
}
const miniRowHideCheckboxStyle = {
  marginLeft: 0,
  marginRight: 4,
  verticalAlign: "middle"
}
const miniEmptyStateStyle = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  backgroundColor: "rgba(255,255,255,0.03)",
  opacity: 0.8
}
const displayPrimaryActiveStyle = {
  ...displayButtonBaseStyle,
  backgroundColor: "var(--bb-theme-primarydark)",
  color: "var(--bb-theme-backgroundprimary)"
}
const displayPrimaryInactiveStyle = {
  ...displayButtonBaseStyle,
  backgroundColor: "rgba(176, 66, 66, 0.9)",
  color: "var(--bb-theme-backgroundprimary)"
}
const displaySecondaryStyle = {
  ...displayButtonBaseStyle,
  backgroundColor: "var(--bb-theme-cha)",
  color: "var(--bb-theme-backgroundprimary)"
}
const displayDangerStyle = {
  ...displayButtonBaseStyle,
  backgroundColor: "var(--bb-theme-error)",
  color: "var(--bb-theme-white)"
}
const darknetStockSelectorWrapStyle = {
  position: "relative",
  display: "inline-flex",
  verticalAlign: "middle"
}
const darknetStockButtonStyle = {
  ...rowButtonBaseStyle,
  whiteSpace: "nowrap",
  textOverflow: "ellipsis"
}
const darknetStockDropdownStyle = {
  ...toolbarDropdownStyle,
  top: "auto",
  bottom: 0,
  transform: "none",
  boxSizing: "border-box",
  gap: 4,
  padding: 8,
  maxHeight: 420
}
const darknetStockGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 4
}
const hashAutoTargetGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 4
}
const sleeveTrainingGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 4
}
const darknetStockOptionStyle = {
  ...displayButtonBaseStyle,
  boxSizing: "border-box",
  border: "2px solid transparent",
  width: "100%",
  height: "auto",
  minHeight: 28,
  padding: "5px 6px",
  marginRight: 0,
  marginBottom: 0,
  whiteSpace: "nowrap"
}
const darknetStockNoneStyle = {
  ...darknetStockOptionStyle,
  ...redStyle
}
const darknetStockAllStyle = {
  ...darknetStockOptionStyle,
  ...greenStyle
}
const darknetStockOwnedStyle = {
  ...darknetStockOptionStyle,
  ...greenStyle
}
const darknetStockUnownedStyle = {
  ...darknetStockOptionStyle,
  ...redStyle
}
const darknetStockSelectedStyle = {
  borderColor: "var(--bb-theme-white)",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.22)"
}
const hoverHelpDB = {
  Display: {
    "Open Logs": "Open tail windows for all running scripts.",
    "Join Discord!!": "Attempts to open a link to the official Bitburner Discord server.  Will also print the link to the terminal.",
    "Create GitHub Issue": "Attempts to open a link to the official GitHub Issues page.  Will also print the link to the terminal.",
    "Clear Active": "Stop active OS scripts, clear their ports, and disable share mode if it is running.",
    "Update": "Run the updater, relaunch the loader, and close the current tail.",
    "Change Log": "Open the SphyxOS change log viewer.",
    "REMOVE PROGRAM": "Remove SphyxOS files after confirmation, including optional local storage cleanup."
  },
  Batcher: {
    "Activate": "Start or stop the batcher controller script.",
    "Auto-Buy Servers": "Let the batcher automatically purchase servers when enabled.",
    "Use Hacknet": "Allow the batcher to use Hacknet resources when enabled.",
    "Auto Hash": "Spend hashes automatically to support the batcher.",
    "Money Mode": "Include money-focused batching in the active strategy.",
    "XP Mode": "Include experience-focused batching in the active strategy.",
    "Charge Stanek": "Charge Stanek fragments between batch cycles.",
    "Pad Grows": "Add extra grow padding for safer batch timing.  Good for rapid level ups.",
    "LogErrors": "Enable additional batcher log/error output.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  Hacknet: {
    "Buy Hacknet": "Run the Hacknet purchasing helper once.",
    "Batcher: AutoBuy": "Let the batcher automatically buy Hacknet upgrades when available."
  },
  Hashing: {
    "No AutoHash": "Choose which hash spending option Auto Hash should use.",
    "Money": "Spend hashes directly for money.",
    "Reduce Min Sec": "Spend hashes to reduce minimum security on the current batch target.",
    "Boost Max Money": "Spend hashes to raise max money on the current batch target.",
    "Generate Contract": "Spend hashes to generate a coding contract.",
    "Corp Money": "Spend hashes for corporation funds.",
    "Corp Research": "Spend hashes for corporation research.",
    "Boost BB Rank": "Spend hashes for Bladeburner rank.",
    "Boost BB SP": "Spend hashes for Bladeburner skill points.",
    "Boost Study": "Spend hashes to improve study gains.",
    "Boost Train": "Spend hashes to improve gym training gains.",
    "Boost Job Favor": "Spend hashes to improve company favor/job progression."
  },
  Stocks: {
    "Activate": "Start or stop the stock trader.",
    "Buy": "Trigger an immediate stock buy pass.",
    "Sell": "Trigger an immediate stock sell pass.",
    "Toggle AutoBuy": "Enable or disable automatic stock buying.",
    "Reset Stats": "Reset tracked stock stats/history.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  Misc: {
    "Backdoor": "Run the basic backdoor helper for reachable servers.",
    "Backdoor Basic": "Use singularity functions to backdoor the basic target set.",
    "Backdoor All": "Use singularity functions to backdoor every eligible server.",
    "Teleport": "Open the teleport/server movement helper.",
    "Solve Contracts": "Run the coding contract solver.",
    "Share Ram": "Start sharing free RAM across the network.",
    "Keep Tab Alive": "Use a low-volume audio context trick to keep the tab active."
  },
  Singularity: {
    "Dump Money": "Spend money on augments and home upgrades.",
    "AutoPilot": "Start or stop the autopilot controller.",
    "Start On Next": "Tell autopilot whether to begin automatically on the next node.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  DarkNet: {
    "Activate": "Start or Stop the Darknet worm.",
    "Phishing": "Enable or Disable Phishing attacks.",
    "Inducing": "Enable or Disable Inducing nearby servers to move.",
    "Sharing": "Enable or Disable Sharing of Darknet RAM.",
    "WebStorm": "Try to start a WebStorm.  Once started, this mode will automatically be disabled.",
    "Stock": "Select which stock the DarkNet helper should promote. None disables stock promotion.  All targets every stock.  Owned stocks show in primary color while unowned stocks show in error color.",
    "Show Lab Map": "Once the Lab has been discovered, show a map of the solvers progress."
  },
  IPvGo: {
    "Activate": "Start or stop the IPvGo bot.",
    "Play White": "Play as white when the bot starts games.",
    "Repeat": "Automatically continue into another game after a match ends.",
    "Cheats": "Allow cheat-assisted behavior where supported.",
    "Logging": "Enable extra logging for IPvGo decisions.",
    "Netburners": "Allow Netburners as an IPvGo opponent.",
    "Slum Snakes": "Allow Slum Snakes as an IPvGo opponent.",
    "The Black Hand": "Allow The Black Hand as an IPvGo opponent.",
    "Tetrads": "Allow Tetrads as an IPvGo opponent.",
    "Daedalus": "Allow Daedalus as an IPvGo opponent.",
    "Illuminati": "Allow Illuminati as an IPvGo opponent.",
    "????????": "Allow the hidden post-fl1ght opponent.",
    "No AI": "Restrict play to non-AI/practice style boards where supported.",
    "SlowMode": "Add a delay before moves so games are easier to follow.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  Gangs: {
    "Activate": "Start or stop the gang manager.",
    "Auto-Ascend": "Automatically ascend gang members when thresholds are met.",
    "Auto-EQ": "Automatically buy gang equipment.",
    "Sleeves": "Assign sleeve support to gang-related work.",
    "AutoMode": "Let the script choose between money and respect automatically.",
    "Respect": "Force the gang to prioritize respect gain.",
    "Money": "Force the gang to prioritize money gain.",
    "Buy EQ All": "Buy equipment for all gang members.",
    "Ascend All": "Ascend every gang member.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  Corps: {
    "Activate": "Start or stop the corporation manager.",
    "Reset TAII": "Clear/reset the TAII database used by the corp scripts.",
    "Bribe": "Spend corporation funds to bribe eligible factions.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  BladeBurner: {
    "Activate": "Start or stop the Bladeburner manager.",
    "Finisher": "Allow the manager to finish the node and move on when ready.",
    "Int Mode": "Bias activity toward intelligence-related gains.",
    "Sleeves": "Assign sleeve support to Bladeburner-related work.",
    "Infil Only": "Limit sleeve support to infiltration-related behavior.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  Stanek: {
    "Charge": "Start charging the current Stanek layout.",
    "Save Config": "Save the current Stanek fragment layout.",
    "Load Config": "Load a saved Stanek fragment layout.",
    "Delete Config": "Delete a saved Stanek fragment layout.",
    "Defaults": "Include default layouts as load options."
  },
  Sleeves: {
    "Activate": "Start or stop the sleeve manager.",
    "Recovery": "Set sleeves to shock recovery mode.",
    "Sync": "Set sleeves to synchronization mode.",
    "Training": "Set sleeves to training mode.",
    "Install Augments": "Allow the sleeve manager to install sleeve augments.",
    "Cash": "Set sleeves to money-making work.",
    "Karma": "Set sleeves to karma-reduction work.",
    "Idle": "Set sleeves to idle.",
    "Int": "Set sleeves to intelligence-focused work.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  Grafting: {
    "Activate": "Start or Stop the auto-grafting helper.",
    "Pop Out": "Open or close a dedicated tail window for this subsystem that can leave the game space."
  },
  Games: {
    "Minesweeper": "Classic Minesweeper with configurable difficulties and mouse support.",
    "DOOM": "Classic DOOM 1, 2 and 3.  Sound and Mouse support.",
    "Timberman": "How long can you avoid the logs?  Left/Right KB Arrows support."
  },
  Cheats: {
    "Dev Menu": "Open the Bitburner developer menu helper.",
    "NOT the Dev Menu": "Opens the SphyxOS tail window dev menu.  Does not give the dev menu achievement",
    "Unlock All Achievements": "Unlock every achievement.",
    "Casino": "Start or stop the Casino script.",
    "Activate": "Start the AutoInfiltration manager.  Waits for 80% Market rate before starting.",
    "Auto": "Enable automatic infiltration handling.",
    "Money": "Use auto infiltration for money rewards.",
    "Faction": "Use auto infiltration for faction reputation rewards."
  }
}
async function proxyAuth(ns, server, password, func, ...argmnts) { return await runItHome(ns, "SphyxOS/darknet/nsProxyAuth.js", [server, password, func, ...argmnts], ns.getFunctionRamCost(func) + 1.6 + 0.05) }
async function runItHome(ns, script, argmts, scriptOverride) {
  const thisPid = ns.exec(script, "home", { ramOverride: scriptOverride, temporary: true }, ...argmts)
  if (thisPid === 0) throw new Error("Failed to run " + script + " on home.")
  await ns.nextPortWrite(thisPid)
  return ns.readPort(thisPid)
}
const hashAutoTargetOptions = [
  { label: "None", value: "None" },
  { label: "Money", value: "money" },
  { label: "MinSec", value: "min" },
  { label: "MaxMoney", value: "max" },
  { label: ".cct's", value: "coding" },
  { label: "C-Money", value: "corp" },
  { label: "C-Research", value: "research" },
  { label: "BBRank", value: "bbrank" },
  { label: "BBSp", value: "bbsp" },
  { label: "Study", value: "study" },
  { label: "Train", value: "train" },
  { label: "Job Favor", value: "favor" }
]
const sleeveTrainingOptions = [
  { label: "None", value: "None" },
  { label: "All", value: "All" },
  { label: "Hack", value: "Hack" },
  { label: "Str", value: "Str" },
  { label: "Def", value: "Def" },
  { label: "Dex", value: "Dex" },
  { label: "Agi", value: "Agi" },
  { label: "Cha", value: "Cha" },
  { label: "Int", value: "Int" }
]
const sleeveLocalModes = ["All", "Hack", "Str", "Def", "Dex", "Agi", "Cha", "Idle", "Recovery", "Sync", "Money", "Karma", "Int"]
