// Reverse of the normal watch/push pipeline: temporarily hosts the Remote File API server that
// Bitburner connects to, requests every file on a server via getAllFiles, and writes them locally
// for inspection under game-pull/<server>/ (never into src/ - anything the game returns is compiled
// JS or hand-typed in-game scripts, never the original TypeScript, so overwriting src/*.ts with it
// would destroy real source).
//
// Usage: node build/pull-from-game.js [server]   (defaults to "home")
//
// Only one process can bind the Remote API port at a time, so stop `npm run watch` first. Once this
// script logs "Waiting for connection...", go to Bitburner's Options -> Remote API and press Connect
// (same hostname/port you already use). It exits automatically after writing the files.
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const server = process.argv[2] || 'home';
const filesyncConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'filesync.json'), 'utf8'));
const port = filesyncConfig.port;
const outDir = path.resolve(__dirname, '..', 'game-pull', server);

console.log(`Starting Remote File API server on port ${port} for server "${server}"...`);
console.log('Stop "npm run watch" first if it is still running (same port).');
console.log('In Bitburner: Options -> Remote API -> Connect.');
console.log('Waiting for connection...');

const wss = new WebSocketServer({ port });

wss.on('connection', (ws) => {
  console.log('Connected. Requesting files...');
  const id = 1;
  ws.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'getAllFiles', params: { server } }));

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id !== id) return;

    if (msg.error) {
      console.error('Error from game:', msg.error);
      wss.close(() => process.exit(1));
      return;
    }

    const files = msg.result;
    fs.mkdirSync(outDir, { recursive: true });
    for (const { filename, content } of files) {
      const target = path.resolve(outDir, filename.replace(/^\//, ''));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, 'utf8');
    }
    console.log(`Wrote ${files.length} files to ${path.relative(process.cwd(), outDir)}`);
    wss.close(() => process.exit(0));
  });
});

wss.on('error', (err) => {
  console.error(err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use - stop "npm run watch" first.`);
  }
  process.exit(1);
});
