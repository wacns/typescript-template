/** @param {NS} ns */
export async function main(ns) {
  const React = globalThis["window"].React
  const doc = globalThis['document']
  const audioCtx = new globalThis["window"].AudioContext();
  let move
  let stop
  let handleKey
  let ending = false
  function TimberGame() {
    const [branches, setBranches] = React.useState(Array(6).fill(0));
    const [playerSide, setPlayerSide] = React.useState(1);
    const [score, setScore] = React.useState(0);
    const [highScore, setHighScore] = React.useState(0);
    const [gameOver, setGameOver] = React.useState(false);
    const [hasFocus, setHasFocus] = React.useState(false);
    const [mode, setMode] = React.useState(null);
    const [timeLeft, setTimeLeft] = React.useState(100);
    const [pos, setPos] = React.useState({ x: globalThis["window"].innerWidth / 2 - 110, y: 100 });
    const [isDragging, setIsDragging] = React.useState(false);

    const playSound = (freq, type, duration, vol = 0.05) => {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
      osc["connect"](gain); gain["connect"](audioCtx.destination);
      osc.start(); osc.stop(audioCtx.currentTime + duration);
    };

    const chop = (side) => {
      if (gameOver || !hasFocus || !mode) return;

      // 1. Move Player First
      setPlayerSide(side);

      // 2. Process Tree Drop
      const nextBranches = [...branches.slice(1)];
      const rand = Math.random();
      const newBranch = rand < 0.38 ? 1 : (rand < 0.76 ? 2 : 0);
      nextBranches.push(newBranch);

      // 3. COLLISION CHECK: Check player side against the NEW bottom branch
      if (nextBranches[0] === side) {
        setGameOver(true);
        playSound(120, 'sawtooth', 0.5, 0.1);
      } else {
        setBranches(nextBranches);
        setScore(s => {
          const ns = s + 1;
          if (ns > highScore) setHighScore(ns);
          return ns;
        });

        if (mode === 'timber') {
          setTimeLeft(p => {
            // INCREASED REFILL: Minimum refill is now 5.5% 
            const bonus = Math.max(5.5, 12 - (score * 0.1));
            return Math.min(100, p + bonus);
          });
        }
        playSound(350 + (score * 2), 'square', 0.04);
      }
    };

    React.useEffect(() => {
      if (mode !== 'timber' || gameOver || !hasFocus) return;
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 0) { setGameOver(true); playSound(100, 'sawtooth', 0.4); return 0; }
          // Slightly softened decay to match the better refill
          const decay = Math.min(1.7, 0.5 + (score * 0.012));
          return Math.max(0, prev - decay);
        });
      }, 50);
      return () => clearInterval(timer);
    }, [mode, gameOver, hasFocus, score]);

    React.useEffect(() => {
      move = (e) => isDragging && setPos({ x: e.clientX - 110, y: e.clientY - 15 });
      stop = () => setIsDragging(false);
      handleKey = (e) => {
        if (!hasFocus || gameOver) return;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault(); e.stopPropagation();
          chop(e.key === "ArrowLeft" ? 1 : 2);
        }
      };
      globalThis["window"].addEventListener("mousemove", move);
      globalThis["window"].addEventListener("mouseup", stop);
      globalThis["window"].addEventListener("keydown", handleKey, true);
      return () => {
        globalThis["window"].removeEventListener("mousemove", move);
        globalThis["window"].removeEventListener("mouseup", stop);
        globalThis["window"].removeEventListener("keydown", handleKey, true);
      };
    }, [isDragging, hasFocus, branches, gameOver, playerSide, mode, score, ending]);

    const reset = (m) => {
      if (m === "quit") ending = true
      else {
        setMode(m); setGameOver(false); setScore(0); setBranches(Array(6).fill(0)); setTimeLeft(100);
        if (audioCtx.state === 'suspended') audioCtx.resume();
      }
    };

    const shake = (mode === 'timber' && timeLeft < 20 && !gameOver) ? (Math.random() - 0.5) * 6 : 0;
    return React.createElement("div", {
      onClick: () => { setHasFocus(true); if (audioCtx.state === 'suspended') audioCtx.resume(); },
      onBlur: () => setHasFocus(false), tabIndex: "0",
      style: {
        position: "fixed", left: pos.x + shake, top: pos.y + shake, width: "220px", height: "480px",
        backgroundColor: "#111", border: `2px solid ${hasFocus ? "#00ff00" : "#444"}`,
        zIndex: "1000", fontFamily: "monospace", color: "#00ff00", outline: "none", userSelect: "none"
      }
    },
      React.createElement("div", { onMouseDown: () => setIsDragging(true), style: { padding: "8px", background: "#222", cursor: "move", fontSize: "10px", textAlign: "center" } },
        hasFocus ? `● ${mode?.toUpperCase()}` : "○ CLICK TO FOCUS"),

      React.createElement("div", { style: { textAlign: "center", padding: "10px" } }, `Score: ${score} | High: ${highScore}`),

      mode === 'timber' && React.createElement("div", { style: { width: "85%", height: "10px", border: "1px solid #0f0", margin: "0 auto 10px", background: "#000" } },
        React.createElement("div", { style: { width: `${timeLeft}%`, height: "100%", background: timeLeft < 30 ? "#f00" : "#0f0" } })),

      React.createElement("div", { style: { position: "relative", width: "40px", height: "250px", background: "#5d4037", margin: "20px auto", opacity: mode ? 1 : 0.2 } },
        branches.map((b, i) => b !== 0 && React.createElement("div", {
          key: i, style: { position: "absolute", bottom: `${i * 50}px`, left: b === 1 ? "-75px" : "40px", width: "75px", height: "18px", background: "#2e7d32" }
        })),
        React.createElement("div", { style: { position: "absolute", bottom: "0", left: playerSide === 1 ? "-55px" : "55px", fontSize: "45px" } }, gameOver ? "💀" : "🪓")
      ),

      (!mode || gameOver) && React.createElement("div", { style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "15px" } },
        gameOver && React.createElement("h2", { style: { color: "#f00" } }, "TIMBER!"),
        React.createElement("button", { onClick: () => reset('casual'), style: { width: "130px", padding: "12px", cursor: "pointer", background: "#111", color: "#0f0", border: "2px solid #0f0" } }, "CASUAL"),
        React.createElement("button", { onClick: () => reset('timber'), style: { width: "130px", padding: "12px", cursor: "pointer", background: "#111", color: "#f00", border: "2px solid #f00" } }, "TIMBER!"),
        React.createElement("button", { onClick: () => reset('quit'), style: { width: "130px", padding: "12px", cursor: "pointer", background: "#111", color: "#f00", border: "2px solid #f00" } }, "Quit")
      )
    );
  }
  ns.writePort(29, ns.pid)
  const container = doc.createElement("div");
  doc.getElementById("root").appendChild(container);
  globalThis["window"].ReactDOM.render(React.createElement(TimberGame), container);
  ns.atExit(() => {
    ns.clearPort(29)
    container.remove(); audioCtx.close();
    globalThis["window"].removeEventListener("mousemove", move);
    globalThis["window"].removeEventListener("mouseup", stop);
    globalThis["window"].removeEventListener("keydown", handleKey, true);
  });
  while (!ending) await ns.asleep(1000);
}