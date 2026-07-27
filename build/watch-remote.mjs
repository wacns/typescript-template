// Replaces the plain `bitburner-filesync` CLI as watch:remote's entry point. Imports its start()
// directly (rather than spawning it as a separate process) so this process and bitburner-filesync's
// internals share the same signal-js singleton event bus and the same live WebSocket connection to
// the game. That lets us bolt an on-demand "pull" (getAllFiles) onto the exact connection
// bitburner-filesync already uses for pushing, instead of needing a second WebSocket server bound to
// the same port - see build/pull-from-game.js, which just drops a trigger file here for this process
// to notice.
import { start } from "bitburner-filesync/src/index.js";
import signal from "signal-js";
import { EventType } from "bitburner-filesync/src/eventTypes.js";
import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";

const triggerFile = path.resolve(process.cwd(), "build", ".pull-request.json");

await start();

let connected = false;
signal.on(EventType.ConnectionMade, () => { connected = true; });

let pending = null;

chokidar.watch(triggerFile).on("add", handleTrigger).on("change", handleTrigger);

function handleTrigger() {
  if (pending) return; // one pull in flight at a time

  let request;
  try {
    request = JSON.parse(fs.readFileSync(triggerFile, "utf8"));
  } catch {
    return;
  }
  fs.rmSync(triggerFile, { force: true });

  if (!connected) {
    console.log("[pull] Not connected to Bitburner yet - reconnect in-game, then run npm run pull:game again.");
    return;
  }

  const server = request.server || "home";
  const id = `pull-${Date.now()}`;
  pending = { id, server };

  console.log(`[pull] Requesting all files from "${server}"...`);
  signal.emit(EventType.MessageSend, { jsonrpc: "2.0", id, method: "getAllFiles", params: { server } });
}

signal.on(EventType.MessageReceived, (raw) => {
  if (!pending) return;

  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (msg.id !== pending.id) return;

  const { server } = pending;
  pending = null;

  if (msg.error) {
    console.error(`[pull] Error from game: ${msg.error}`);
    return;
  }

  const outDir = path.resolve(process.cwd(), "game-pull", server);
  fs.mkdirSync(outDir, { recursive: true });
  for (const { filename, content } of msg.result) {
    const target = path.resolve(outDir, filename.replace(/^\//, ""));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
  console.log(`[pull] Wrote ${msg.result.length} files to game-pull/${server}/`);
});
