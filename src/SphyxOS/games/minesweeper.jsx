/**Author:
 * Discord:
 * - goos
 * 
 * Additional Contributers:
 * Discord:
 * - Sphyxis
 */

//Settings
const SAVE_FILE = "SphyxOSUserData/games/minesweeperHighScores.txt"
const START_HIGH_SCORE = 999000
const DIFFICULTIES = {
  Beginner: { boardRow: 9, boardCol: 9, maxNumberOfMines: 10 },
  Intermediate: { boardRow: 16, boardCol: 16, maxNumberOfMines: 40 },
  Expert: { boardRow: 16, boardCol: 30, maxNumberOfMines: 99 },
}
const VISIT = {
  unknown: 0,
  known: 1,
  flagged: 2,
}
const CELL_SIZE = 28
const BOARD_PADDING_X = 80
const BOARD_PADDING_Y = 250
const MIN_TAIL_WIDTH = 420
const MIN_TAIL_HEIGHT = 420
const NUMBER_COLORS = {
  1: "#3b82f6",
  2: "#16a34a",
  3: "#dc2626",
  4: "#7c3aed",
  5: "#b45309",
  6: "#0891b2",
  7: "#334155",
  8: "#6b7280",
}

function generateGrid({ boardRow, boardCol }, value = 0) {
  const grid = []
  for (let row = 0; row < boardRow; row++) {
    grid.push(Array(boardCol).fill(value))
  }
  return grid
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max)
}

function isValidCoordinates(row, col, { boardRow, boardCol }) {
  return row >= 0 && row < boardRow && col >= 0 && col < boardCol
}

function getSurroundingCoordinates([centerRow, centerCol], boardSize) {
  const surroundingCoords = []
  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      const nearbyRow = centerRow + rowOffset
      const nearbyCol = centerCol + colOffset
      if (!isValidCoordinates(nearbyRow, nearbyCol, boardSize)) continue
      surroundingCoords.push([nearbyRow, nearbyCol])
    }
  }
  return surroundingCoords
}

function firstTurnSafetyField(gridArea, currentPosition, boardSize) {
  const safeGrid = gridArea.map((row) => [...row])
  for (const [row, col] of getSurroundingCoordinates(currentPosition, boardSize)) {
    safeGrid[row][col] -= 1
  }
  return safeGrid
}

function generateMinefield(gridArea, boardSize, maxNumberOfMines) {
  const nextGrid = gridArea.map((row) => [...row])
  const selectableCoords = []
  for (let row = 0; row < boardSize.boardRow; row++) {
    for (let col = 0; col < boardSize.boardCol; col++) {
      selectableCoords.push([row, col])
    }
  }
  for (let mines = 0; mines < maxNumberOfMines;) {
    const coordsIndex = getRandomInt(selectableCoords.length)
    const [randomRow, randomCol] = selectableCoords[coordsIndex]
    if (nextGrid[randomRow][randomCol] < 0) {
      selectableCoords.splice(coordsIndex, 1)
      continue
    }
    if (typeof nextGrid[randomRow][randomCol] !== "string") {
      selectableCoords.splice(coordsIndex, 1)
      nextGrid[randomRow][randomCol] = "Mine"
      mines++
    }
  }
  return nextGrid
}

function countNearbyMine(gridArea, currentPosition, boardSize) {
  let numOfMines = 0
  for (const [row, col] of getSurroundingCoordinates(currentPosition, boardSize)) {
    if (typeof gridArea[row][col] === "string") numOfMines += 1
  }
  return numOfMines
}

function updateCellNearby(gridArea, boardSize) {
  const nextGrid = gridArea.map((row) => [...row])
  for (let row = 0; row < nextGrid.length; row++) {
    for (let col = 0; col < nextGrid[row].length; col++) {
      if (nextGrid[row][col] < 0) nextGrid[row][col] += 1
      nextGrid[row][col] += countNearbyMine(nextGrid, [row, col], boardSize)
    }
  }
  return nextGrid
}

function createBoard(boardSize, maxNumberOfMines) {
  return {
    boardSize,
    maxNumberOfMines,
    gridArea: generateGrid(boardSize),
    gridInfo: generateGrid(boardSize, VISIT.unknown),
    isFirstTurn: true,
    isGameOver: false,
    isWin: false,
  }
}

function ensureBoardGenerated(state, currentPosition) {
  if (!state.isFirstTurn) return state
  let gridArea = firstTurnSafetyField(state.gridArea, currentPosition, state.boardSize)
  gridArea = generateMinefield(gridArea, state.boardSize, state.maxNumberOfMines)
  gridArea = updateCellNearby(gridArea, state.boardSize)
  return {
    ...state,
    gridArea,
    isFirstTurn: false,
  }
}

function floodDiscovery(gridArea, gridInfo, currentPosition, boardSize) {
  const nextInfo = gridInfo.map((row) => [...row])
  const [startRow, startCol] = currentPosition
  if (gridArea[startRow][startCol] !== 0) return nextInfo

  const toVisit = [currentPosition]
  for (let index = 0; index < toVisit.length; index++) {
    const [row, col] = toVisit[index]
    nextInfo[row][col] = VISIT.known
    if (gridArea[row][col] !== 0) continue

    for (const [newRow, newCol] of getSurroundingCoordinates([row, col], boardSize)) {
      const alreadyQueued = toVisit.some(([queuedRow, queuedCol]) => queuedRow === newRow && queuedCol === newCol)
      if (alreadyQueued) continue
      if (nextInfo[newRow][newCol] === VISIT.unknown) {
        toVisit.push([newRow, newCol])
      }
    }
  }
  return nextInfo
}

function chordingTile(gridArea, gridInfo, currentPosition, boardSize) {
  const nextInfo = gridInfo.map((row) => [...row])
  const [centerRow, centerCol] = currentPosition
  const neededNum = gridArea[centerRow][centerCol]
  let nearbyFlagged = 0
  const surroundingCoords = getSurroundingCoordinates(currentPosition, boardSize)

  for (const [row, col] of surroundingCoords) {
    if (nextInfo[row][col] === VISIT.flagged) nearbyFlagged += 1
  }
  if (neededNum !== nearbyFlagged) return nextInfo

  for (const [row, col] of surroundingCoords) {
    if (nextInfo[row][col] === VISIT.flagged) continue
    if (nextInfo[row][col] === VISIT.known) continue
    nextInfo[row][col] = VISIT.known
    const floodedInfo = floodDiscovery(gridArea, nextInfo, [row, col], boardSize)
    for (let infoRow = 0; infoRow < nextInfo.length; infoRow++) {
      nextInfo[infoRow] = [...floodedInfo[infoRow]]
    }
  }
  return nextInfo
}

function countFlags(gridInfo) {
  let total = 0
  for (const row of gridInfo) {
    for (const cell of row) {
      if (cell === VISIT.flagged) total++
    }
  }
  return total
}

function checkIfWin(gridArea, gridInfo, maxNumberOfMines) {
  let correctFlags = 0
  let totalFlags = 0
  for (let row = 0; row < gridArea.length; row++) {
    for (let col = 0; col < gridArea[row].length; col++) {
      if (gridInfo[row][col] === VISIT.flagged) {
        totalFlags++
        if (typeof gridArea[row][col] === "string") correctFlags++
      }
    }
  }
  return correctFlags === maxNumberOfMines && totalFlags === maxNumberOfMines
}

function revealBoardLossState(state) {
  const nextState = { ...state }
  nextState.isGameOver = true
  return nextState
}

function applyReveal(state, currentPosition) {
  if (state.isGameOver || state.isWin) return state
  const [row, col] = currentPosition
  if (state.gridInfo[row][col] === VISIT.flagged) return state

  const preparedState = ensureBoardGenerated(state, currentPosition)
  const nextState = {
    ...preparedState,
    gridInfo: preparedState.gridInfo.map((infoRow) => [...infoRow]),
  }

  if (preparedState.gridArea[row][col] !== 0 && nextState.gridInfo[row][col] === VISIT.known) {
    nextState.gridInfo = chordingTile(preparedState.gridArea, nextState.gridInfo, currentPosition, preparedState.boardSize)
  } else {
    nextState.gridInfo[row][col] = VISIT.known
    nextState.gridInfo = floodDiscovery(preparedState.gridArea, nextState.gridInfo, currentPosition, preparedState.boardSize)
  }

  for (let scanRow = 0; scanRow < nextState.gridInfo.length; scanRow++) {
    for (let scanCol = 0; scanCol < nextState.gridInfo[scanRow].length; scanCol++) {
      if (
        nextState.gridInfo[scanRow][scanCol] === VISIT.known &&
        typeof nextState.gridArea[scanRow][scanCol] === "string"
      ) {
        return revealBoardLossState(nextState)
      }
    }
  }

  if (checkIfWin(nextState.gridArea, nextState.gridInfo, nextState.maxNumberOfMines)) {
    nextState.isWin = true
  }
  return nextState
}

function applyFlagToggle(state, currentPosition) {
  if (state.isGameOver || state.isWin) return state
  const [row, col] = currentPosition
  const nextGridInfo = state.gridInfo.map((infoRow) => [...infoRow])
  if (nextGridInfo[row][col] === VISIT.known) return state

  nextGridInfo[row][col] = nextGridInfo[row][col] === VISIT.flagged ? VISIT.unknown : VISIT.flagged
  return {
    ...state,
    gridInfo: nextGridInfo,
    isWin: checkIfWin(state.gridArea, nextGridInfo, state.maxNumberOfMines),
  }
}

function parseHighScores(ns) {
  try {
    ns.scp(SAVE_FILE, ns.self().server, "home")
    const file = ns.read(SAVE_FILE)
    if (!file) return new Map()
    return new Map(JSON.parse(file))
  } catch {
    return new Map()
  }
}

function scoreKey(boardSize, maxNumberOfMines) {
  return `${boardSize.boardRow}x${boardSize.boardCol}:${maxNumberOfMines}`
}

function getHighScore(highScores, boardSize, maxNumberOfMines) {
  return highScores.get(scoreKey(boardSize, maxNumberOfMines)) ?? START_HIGH_SCORE
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--"
  return seconds.toFixed(1)
}

function getTailSize(boardSize) {
  return {
    width: Math.max(MIN_TAIL_WIDTH, (boardSize.boardCol * CELL_SIZE) + BOARD_PADDING_X),
    height: Math.max(MIN_TAIL_HEIGHT, (boardSize.boardRow * CELL_SIZE) + BOARD_PADDING_Y),
  }
}

function getCellLabel(cellState, infoState, isGameOver) {
  if (isGameOver && typeof cellState === "string") return "X"
  if (infoState === VISIT.flagged) return "F"
  if (infoState === VISIT.unknown) return ""
  if (typeof cellState === "string") return "X"
  if (cellState === 0) return ""
  return String(cellState)
}

function getCellStyle(cellState, infoState, isGameOver) {
  const isKnown = infoState === VISIT.known || (isGameOver && typeof cellState === "string")
  const isMine = typeof cellState === "string" && (isGameOver || infoState === VISIT.known)
  const baseStyle = {
    width: CELL_SIZE,
    height: CELL_SIZE,
    border: "1px solid #334155",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    userSelect: "none",
    backgroundColor: isKnown ? "#dbe4ee" : "#94a3b8",
    color: "#0f172a",
  }
  if (infoState === VISIT.flagged) {
    baseStyle.backgroundColor = "#f59e0b"
    baseStyle.color = "#111827"
  } else if (isMine) {
    baseStyle.backgroundColor = "#ef4444"
    baseStyle.color = "#ffffff"
  } else if (isKnown && typeof cellState === "number" && cellState > 0) {
    baseStyle.color = NUMBER_COLORS[cellState] ?? "#111827"
  }
  return baseStyle
}

function App({ ns, initialHighScores }) {
  const React = globalThis["React"] ?? globalThis["window"]?.React
  const [difficulty, setDifficulty] = React.useState("Beginner")
  const [customRows, setCustomRows] = React.useState("Rows")
  const [customCols, setCustomCols] = React.useState("Columns")
  const [customMines, setCustomMines] = React.useState("Mines")
  const [highScores, setHighScores] = React.useState(initialHighScores)
  const [startMs, setStartMs] = React.useState(Date.now())
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0)
  const [statusMessage, setStatusMessage] = React.useState("Left click to reveal. Right click to flag.")

  function getConfig() {
    if (difficulty !== "Custom") return DIFFICULTIES[difficulty]
    const boardRow = Number(customRows)
    const boardCol = Number(customCols)
    const maxNumberOfMines = Number(customMines)
    if (!Number.isInteger(boardRow) || !Number.isInteger(boardCol) || !Number.isInteger(maxNumberOfMines)) {
      return null
    }
    if (boardRow < 3 || boardCol < 3 || maxNumberOfMines < 1) return null
    if (maxNumberOfMines > (boardRow * boardCol) - 9) return null
    return { boardRow, boardCol, maxNumberOfMines }
  }

  const initialConfig = getConfig() ?? DIFFICULTIES.Beginner
  const [gameState, setGameState] = React.useState(() => createBoard(initialConfig, initialConfig.maxNumberOfMines))

  const currentHighScore = getHighScore(highScores, gameState.boardSize, gameState.maxNumberOfMines)
  const minesRemaining = gameState.maxNumberOfMines - countFlags(gameState.gridInfo)

  React.useEffect(() => {
    if (gameState.isWin || gameState.isGameOver) {
      setElapsedSeconds((Date.now() - startMs) / 1000)
      return
    }
    const intervalId = globalThis["window"]?.setInterval(() => {
      setElapsedSeconds((Date.now() - startMs) / 1000)
    }, 100)
    return () => globalThis["window"]?.clearInterval(intervalId)
  }, [startMs, gameState.isWin, gameState.isGameOver])

  React.useEffect(() => {
    if (!gameState.isWin) return
    const finalTime = (Date.now() - startMs) / 1000
    setElapsedSeconds(finalTime)
    const key = scoreKey(gameState.boardSize, gameState.maxNumberOfMines)
    const oldScore = highScores.get(key) ?? START_HIGH_SCORE
    if (finalTime < oldScore) {
      const nextScores = new Map(highScores)
      nextScores.set(key, finalTime)
      setHighScores(nextScores)
      try {
        ns.write(SAVE_FILE, JSON.stringify(Array.from(nextScores)), "w")
        ns.scp(SAVE_FILE, "home")
        setStatusMessage(`You won in ${formatTime(finalTime)}s. New high score.`)
      }
      catch { setStatusMessage(`Saving of highscores is disabled while the script is stopped.`) }
      return
    }
    else setStatusMessage(`You won in ${formatTime(finalTime)}s.`)
  }, [gameState.isWin, gameState.boardSize, gameState.maxNumberOfMines, highScores, ns, startMs])

  React.useEffect(() => {
    if (!gameState.isGameOver) return
    setStatusMessage("Game over. Press New Game to try again.")
  }, [gameState.isGameOver])

  React.useEffect(() => {
    const { width, height } = getTailSize(gameState.boardSize)
    try { ns.ui.resizeTail(width, height) } catch { }
  }, [gameState.boardSize, ns])

  function resetGame(nextDifficulty = difficulty) {
    const config = nextDifficulty === "Custom"
      ? getConfig()
      : DIFFICULTIES[nextDifficulty]
    if (!config) {
      setStatusMessage("Custom settings must be whole numbers, at least 3x3, with room for a safe first click.")
      return
    }
    setDifficulty(nextDifficulty)
    setGameState(createBoard(config, config.maxNumberOfMines))
    setStartMs(Date.now())
    setElapsedSeconds(0)
    setStatusMessage("Left click to reveal. Right click to flag.")
  }

  function handleReveal(row, col) {
    setGameState((prevState) => applyReveal(prevState, [row, col]))
  }

  function handleFlag(row, col) {
    setGameState((prevState) => applyFlagToggle(prevState, [row, col]))
  }

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Minesweeper</div>
          <div style={styles.subtitle}>Mouse controls: left click reveal, right click flag.</div>
        </div>
        <div style={styles.controls}>
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} style={styles.select}>
            {Object.keys(DIFFICULTIES).map((name) => <option key={name} value={name}>{name}</option>)}
            <option value="Custom">Custom</option>
          </select>
          {difficulty === "Custom" && (
            <div style={styles.customControls}>
              <input value={customRows} onChange={(event) => setCustomRows(event.target.value)} style={styles.input} placeholder="Rows"></input>
              <input value={customCols} onChange={(event) => setCustomCols(event.target.value)} style={styles.input} placeholder="Cols"></input>
              <input value={customMines} onChange={(event) => setCustomMines(event.target.value)} style={styles.input} placeholder="Mines"></input>
            </div>
          )}
          <button style={styles.button} onClick={() => resetGame(difficulty)}>New Game</button>
        </div>
      </div>

      <div style={styles.stats}>
        <span>Time: {formatTime(gameState.isWin || gameState.isGameOver ? elapsedSeconds : elapsedSeconds)}</span>
        <span>Mines: {minesRemaining}</span>
        <span>Best: {currentHighScore >= START_HIGH_SCORE ? "--" : formatTime(currentHighScore)}</span>
      </div>

      <div style={styles.status}>{statusMessage}</div>

      <div
        style={{
          ...styles.board,
          gridTemplateColumns: `repeat(${gameState.boardSize.boardCol}, ${CELL_SIZE}px)`,
        }}
      >
        {gameState.gridArea.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const infoState = gameState.gridInfo[rowIndex][colIndex]
            const label = getCellLabel(cell, infoState, gameState.isGameOver)
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                style={getCellStyle(cell, infoState, gameState.isGameOver)}
                onClick={() => handleReveal(rowIndex, colIndex)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  handleFlag(rowIndex, colIndex)
                }}
                title={`Row ${rowIndex + 1}, Col ${colIndex + 1}`}
              >
                {label}
              </button>
            )
          })
        )}
      </div>

      <div style={styles.footer}>
        Left click an opened number to chord when its surrounding flags match the number.
      </div>
    </div>
  )
}

const styles = {
  app: {
    fontFamily: "Verdana, sans-serif",
    color: "#e2e8f0",
    backgroundColor: "#0f172a",
    padding: 16,
    minHeight: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
  },
  subtitle: {
    color: "#94a3b8",
    marginTop: 4,
  },
  controls: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  customControls: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  select: {
    padding: "6px 10px",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #475569",
  },
  input: {
    width: 70,
    padding: "6px 8px",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid #475569",
  },
  button: {
    padding: "6px 12px",
    backgroundColor: "#22c55e",
    color: "#052e16",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  stats: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 8,
    fontWeight: 700,
  },
  status: {
    marginBottom: 12,
    color: "#cbd5e1",
  },
  board: {
    display: "grid",
    gap: 0,
    width: "fit-content",
    border: "2px solid #475569",
    backgroundColor: "#475569",
  },
  footer: {
    marginTop: 12,
    color: "#94a3b8",
    maxWidth: 700,
  },
}

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL")
  ns.clearLog()
  ns.ui.openTail()
  const highScores = parseHighScores(ns)
  ns.clearPort(27)
  ns.writePort(27, ns.pid)
  ns.atExit(() => { ns.clearPort(27) })
  ns.printRaw(<App ns={ns} initialHighScores={highScores}></App>)
  await new Promise(() => { })
}
