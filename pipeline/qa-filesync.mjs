#!/usr/bin/env node
/**
 * A second, disposable filesync server dedicated to automated QA.
 *
 * Bitburner's Remote File API accepts one game per port, so a QA browser cannot use the port
 * `npm run watch` already holds - it would steal the developer's live game connection. This serves
 * the same dist/ tree on a separate port so a throwaway Playwright game can pull the compiled
 * scripts without disturbing anything.
 *
 * bitburner-filesync reads its settings through convict, which exposes BB_PORT and BB_SCRIPTFOLDER
 * as environment variables but ALSO auto-loads ./filesync.json - and that file would put the port
 * straight back to 12525. So this runs from a scratch directory where no filesync.json exists and
 * passes dist/ as an absolute path.
 *
 *   node pipeline/qa-filesync.mjs            serve dist/ on 12526
 *   node pipeline/qa-filesync.mjs --port N
 */

import {mkdtempSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const portIndex = argv.indexOf('--port');
const PORT = String(portIndex >= 0 ? argv[portIndex + 1] : 12526);
const DIST = path.join(ROOT, 'dist');

if (!existsSync(DIST)) {
    console.error('[qa-filesync] dist/ does not exist - run `npx tsc` first');
    process.exit(2);
}

// Must be set before the module loads: convict reads env at schema definition time.
process.env.BB_PORT = PORT;
process.env.BB_SCRIPTFOLDER = DIST;

// Escape the project directory so filesync.json is not auto-loaded over our settings.
process.chdir(mkdtempSync(path.join(tmpdir(), 'wacn-qa-')));

console.log(`[qa-filesync] serving ${DIST} on port ${PORT}`);
console.log('[qa-filesync] in the QA game: Options -> Remote API -> port ' + PORT + ' -> Connect');

const {start} = await import('bitburner-filesync/src/index.js');
await start();
