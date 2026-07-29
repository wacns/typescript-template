/**
 * Fails the build when a declaration in src/ shares its name with a costly Netscript API function.
 *
 * WHY THIS EXISTS
 *
 * Bitburner charges a script's RAM by walking its AST and resolving every identifier against the
 * whole ns API tree BY NAME, ignoring namespaces (BitBurner-Src/src/Script/RamCalculations.ts,
 * `findFunc` - it recurses through RamCosts looking for a matching key at any depth). So a local
 * function you happen to call `workForFaction` is billed as `ns.singularity.workForFaction`: 48GB,
 * even though ns.singularity is never touched.
 *
 * This is invisible to tsc and eslint. It was discovered only by running the code in a real game,
 * where WacnOS/autopilot/daemon.js measured 225.55GB instead of 7.35GB - 218GB of it from four
 * innocuous names: installAugmentations (80), goToLocation (80), workForFaction (48), attempt (10,
 * a loop counter matching codingcontract.attempt). A fifth, `run` as an object property, cost 1GB.
 *
 * On a fresh BitNode home has 8GB, so a collision like that doesn't slow a script down - it makes
 * it unrunnable, silently, long after the code was written and reviewed.
 *
 * WHAT IT CHECKS
 *
 * Only DECLARATIONS and object property keys: function/const/let/var/class names, loop variables,
 * catch bindings, destructuring bindings (one level deep, including renamed property keys - the
 * game bills both sides of `{a: b}`), and named import specifiers (`import type` and `type X`
 * specifiers are skipped: tsc erases them, so they never reach the game's AST). Those are
 * unambiguous - a declaration named `workForFaction` is never a legitimate ns call.
 *
 * Function PARAMETERS are a known gap: TypeScript type annotations make parameter-name extraction
 * regex-hostile, so a parameter named after an ns function still slips through. Member accesses
 * (`ns.stock.hasWseAccount()`) are deliberately NOT flagged, because there is no way to tell an
 * intended call from an accidental collision by name alone, and the intended case is
 * overwhelmingly common.
 *
 * Usage:  node build/check-ram-collisions.js [--json]
 * Exit:   0 clean, 1 collisions found, 2 could not run the check
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const RAM_COSTS = path.join(PROJECT_ROOT, 'BitBurner-Src', 'src', 'Netscript', 'RamCostGenerator.ts');

/**
 * Directories excluded from the scan.
 * - SphyxOS is a vendored third-party toolkit, overwritten wholesale by `npm run update:sphyxos`;
 *   flagging its names would produce permanent unfixable noise.
 * - archive/ holds superseded experiments that are never run.
 */
const EXCLUDED = [path.join('src', 'SphyxOS'), path.join('src', 'Dispatchers', 'archive')];

/** Names that collide but cost nothing, so they are harmless and would only be noise. */
const ZERO_COST_ALLOWED = new Set([
    'sleep', 'flags', 'print', 'tprint', 'asleep', 'atExit', 'clearLog', 'disableLog', 'enableLog',
    'formatNumber', 'formatRam', 'formatPercent', 'tprintRaw', 'printRaw', 'ramOverride',
    // ns.formulas.* is free (it only needs Formulas.exe at runtime, not RAM).
    'hackChance', 'hackPercent', 'growThreads', 'growPercent', 'hackExp', 'hackTime', 'growTime',
    'weakenTime', 'calculateSkill', 'calculateExp', 'skills', 'exp',
]);

function fail(message) {
    console.error(`check-ram-collisions: ${message}`);
    process.exit(2);
}

/** Every ns identifier that carries a non-zero RAM cost, mapped to that cost. */
function loadCostlyNames() {
    if (!fs.existsSync(RAM_COSTS)) {
        fail(`cannot find ${path.relative(PROJECT_ROOT, RAM_COSTS)}.\n` +
            '  The BitBurner-Src submodule is missing. Run: git submodule update --init');
    }
    const source = fs.readFileSync(RAM_COSTS, 'utf8');

    // Numeric constants (RamCostConstants) so symbolic costs can be resolved.
    const constants = new Map();
    for (const m of source.matchAll(/^\s*([A-Za-z_][\w]*)\s*:\s*([0-9.]+)\s*,/gm)) {
        constants.set(m[1], Number(m[2]));
    }

    const costly = new Map();
    // `name: <cost>` where cost is a literal, a RamCostConstants member, or an SF-gated wrapper.
    const entry = /^\s*([A-Za-z_][\w]*)\s*:\s*(?:RamCostConstants\.([A-Za-z_][\w]*)|SF4Cost\(\s*(?:RamCostConstants\.([A-Za-z_][\w]*)|([0-9.]+))\s*\)|([0-9.]+))/gm;
    for (const m of source.matchAll(entry)) {
        const [, name, constRef, sf4Const, sf4Literal, literal] = m;
        let cost;
        if (constRef) cost = constants.get(constRef);
        else if (sf4Const) cost = constants.get(sf4Const) * 16;   // SF4Cost bills 16x without SF4
        else if (sf4Literal) cost = Number(sf4Literal) * 16;
        else cost = Number(literal);

        if (typeof cost === 'number' && cost > 0) {
            costly.set(name, Math.max(cost, costly.get(name) ?? 0));
        }
    }
    return costly;
}

function sourceFiles(dir, out = []) {
    for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
        const full = path.join(dir, item.name);
        const rel = path.relative(PROJECT_ROOT, full);
        if (EXCLUDED.some((ex) => rel.startsWith(ex))) continue;
        if (item.isDirectory()) sourceFiles(full, out);
        else if (/\.tsx?$/.test(item.name)) out.push(full);
    }
    return out;
}

/** Strips comments and string/template literals so their contents can't produce false positives. */
function stripNonCode(text) {
    return text
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``')
        .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, "''")
        .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""');
}

/** Declared names in one file, with the line each was declared on. */
function declarations(code) {
    const found = new Map();
    const record = (name, index) => {
        if (!found.has(name)) found.set(name, code.slice(0, index).split('\n').length);
    };

    const patterns = [
        /\b(?:function|class)\s+([A-Za-z_][\w]*)/g,          // function foo / class Foo
        /\b(?:const|let|var)\s+([A-Za-z_][\w]*)/g,           // const foo
        /\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_][\w]*)/g, // for (const foo
        /^\s*(?:async\s+)?([A-Za-z_][\w]*)\s*[:(]/gm,        // object keys and method shorthand
        /\bcatch\s*\(\s*([A-Za-z_][\w]*)/g,                  // catch (foo)
    ];
    for (const pattern of patterns) {
        for (const m of code.matchAll(pattern)) record(m[1], m.index);
    }

    // Destructuring bindings: const {a, b: c, d = 1, ...rest} = x / const [a, , b] = x, including
    // for (const {a} of ...). Every identifier in the pattern is an Identifier node the game
    // bills - renamed property keys too, so `{a: b}` flags both. One level deep only (this is a
    // regex checker, not a parser); default-value expressions are stripped so their contents
    // aren't flagged.
    for (const m of code.matchAll(/\b(?:const|let|var)\s*([{[][^}\]]*[}\]])/g)) {
        const body = m[1].slice(1, -1).replace(/=[^,]*/g, ' ');
        for (const id of body.matchAll(/[A-Za-z_][\w]*/g)) record(id[0], m.index);
    }

    // Named import specifiers: import {a, b as c} from "..." flags a, b, and c - the game bills
    // both the imported and the local name. `import type {...}` lines and `type X` specifiers are
    // skipped: tsc erases them, so they never reach the game's AST.
    for (const m of code.matchAll(/^\s*import\s+(?!type\b)(?:[A-Za-z_][\w]*\s*,\s*)?\{([^}]*)\}/gm)) {
        for (const spec of m[1].split(',')) {
            const s = spec.trim();
            if (!s || /^type\b/.test(s)) continue;
            for (const id of s.matchAll(/[A-Za-z_][\w]*/g)) {
                if (id[0] !== 'as') record(id[0], m.index);
            }
        }
    }
    return found;
}

function main() {
    const asJson = process.argv.includes('--json');
    const costly = loadCostlyNames();
    if (costly.size === 0) fail('parsed no RAM costs - RamCostGenerator.ts format may have changed');

    if (!fs.existsSync(SRC_DIR)) fail('src/ not found');

    const hits = [];
    for (const file of sourceFiles(SRC_DIR)) {
        const code = stripNonCode(fs.readFileSync(file, 'utf8'));
        for (const [name, line] of declarations(code)) {
            if (ZERO_COST_ALLOWED.has(name)) continue;
            const cost = costly.get(name);
            if (cost) {
                hits.push({file: path.relative(PROJECT_ROOT, file).replace(/\\/g, '/'), line, name, cost});
            }
        }
    }

    hits.sort((a, b) => b.cost - a.cost);

    if (asJson) {
        console.log(JSON.stringify({ok: hits.length === 0, hits}, null, 2));
        process.exit(hits.length === 0 ? 0 : 1);
    }

    if (hits.length === 0) {
        console.log(`check-ram-collisions: OK (checked ${costly.size} costly ns names)`);
        process.exit(0);
    }

    const total = hits.reduce((sum, h) => sum + h.cost, 0);
    console.error(`\ncheck-ram-collisions: ${hits.length} declaration(s) collide with costly ns API names\n`);
    for (const h of hits) {
        console.error(`  ${String(h.cost).padStart(6)}GB  ${h.name}`);
        console.error(`            ${h.file}:${h.line}`);
    }
    console.error(`\n  Up to ${total.toFixed(2)}GB of phantom RAM cost. Bitburner resolves identifiers`);
    console.error('  against the whole ns tree by name, ignoring namespaces, so these are billed as');
    console.error('  real API calls. Rename them - the cost is invisible to tsc and eslint, and on a');
    console.error('  fresh BitNode (8GB home) it makes the script unrunnable rather than merely slow.\n');
    process.exit(1);
}

main();
