// Requests a pull from the currently-running `npm run watch` session, which handles it over its
// existing live connection to the game (see build/watch-remote.mjs) - this just drops a trigger file
// and returns immediately.
//
// Usage: npm run pull:game [server]   (defaults to "home")
//
// Requires npm run watch to already be running and connected to Bitburner. Files land under
// game-pull/<server>/ once picked up - never src/, since anything the game returns is compiled JS
// (or scripts typed directly in-game), never the original TypeScript.
const fs = require('fs');
const path = require('path');

const server = process.argv[2] || 'home';
const triggerFile = path.resolve(__dirname, '.pull-request.json');

fs.writeFileSync(triggerFile, JSON.stringify({ server, requestedAt: Date.now() }), 'utf8');

console.log(`Pull requested for "${server}".`);
console.log(`Check the terminal running "npm run watch" - files will land in game-pull/${server}/ once picked up.`);
console.log('(Requires npm run watch to be running and already connected to Bitburner.)');
