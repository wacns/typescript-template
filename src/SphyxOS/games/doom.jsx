/**Author:
 * Discord:
 * - Sphyxis
 */
const DOOM_URL = "https://raz0red.github.io/webprboom/"
const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 760

function getFrame() {
  return globalThis["document"]?.getElementById("bitburner-doom-frame")
}

function focusDoomFrame() {
  const frame = getFrame()
  if (!frame) return

  frame.focus({ preventScroll: true })
  try {
    frame.contentWindow?.focus()
  } catch (_) {}
}

function focusDoomFrameSoon() {
  focusDoomFrame()
  //If we still lose focus, enable these
  //globalThis["setTimeout"]?.(focusDoomFrame, 50)
  //globalThis["setTimeout"]?.(focusDoomFrame, 250)
}

function DoomPlayer() {
  return (
    <div style={styles.shell}>
      <iframe
        id="bitburner-doom-frame"
        title="DOOM"
        src={DOOM_URL}
        tabIndex={0}
        allow="autoplay; fullscreen; gamepad"
        onLoad={focusDoomFrameSoon}
        onMouseDown={focusDoomFrameSoon}
        onPointerDown={focusDoomFrameSoon}
        onMouseEnter={focusDoomFrame}
        style={styles.frame}
      ></iframe>
    </div>
  )
}

const styles = {
  shell: {
    width: "100%",
    maxWidth: "100%",
    aspectRatio: "4 / 3",
    maxHeight: "100vh",
    margin: 0,
    padding: 0,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  frame: {
    display: "block",
    width: "100%",
    height: "100%",
    border: "none",
    margin: 0,
    padding: 0,
    backgroundColor: "#000000",
    outline: "none",
  },
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  ns.clearLog()
  ns.ui.openTail()
  ns.ui.setTailTitle("DOOM - BitBurner Edition - Click to Play")
  ns.ui.resizeTail(DEFAULT_WIDTH, DEFAULT_HEIGHT)
  ns.printRaw(<DoomPlayer></DoomPlayer>)
  //await new Promise(() => { })
}
