#!/usr/bin/env node
/**
 * Continuous multi-agent development loop.
 *
 * Runs Architect -> Developer -> QA -> Organizer in sequence, repeatedly, each as a separate
 * headless Claude Code session so no single context window has to survive the whole run.
 * State passes between them through files in .claude-pipeline/queue/, not through context.
 *
 * Node rather than Python: this repo already depends on Node, so there is no new runtime to
 * install, and process handling behaves identically on Windows, macOS and Linux.
 *
 *   node pipeline/run.mjs                 5 cycles
 *   node pipeline/run.mjs --cycles 20     20 cycles
 *   node pipeline/run.mjs --dry-run       print the prompts, call nothing
 *   node pipeline/run.mjs --once          a single cycle
 *
 * THE MERGE GATE IS NOT HERE. The Organizer never merges to main. It evaluates, records, and
 * leaves a branch for a human to verify in a running game - because `npm run verify` passing is
 * a weak signal in this project (see PROGRESS.md). An autonomous loop that merged on green would
 * happily ship the RAM-collision, deadlock and never-submitted-command classes of bug that have
 * already occurred here, all of which were green under tsc and eslint.
 */

import {execFile, execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, appendFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = path.join(ROOT, '.claude-pipeline', 'queue');
const PROPOSED = path.join(QUEUE, '1_proposed');
const IMPLEMENTED = path.join(QUEUE, '2_implemented');
const BLOCKED = path.join(QUEUE, '3_blocked');
const LOG = path.join(ROOT, '.claude-pipeline', 'pipeline.log');

/** Per-agent wall-clock limit. A hung session must not stall the loop forever. */
const AGENT_TIMEOUT_MS = 20 * 60 * 1000;
/** Pause between cycles, so a runaway loop is interruptible and rate limits are respected. */
const COOLDOWN_MS = 15_000;

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DRY_RUN = flag('dry-run');
const CYCLES = flag('once') ? 1 : Number(value('cycles', 5));

function log(line) {
    const stamped = `[${new Date().toISOString()}] ${line}`;
    console.log(stamped);
    try {
        appendFileSync(LOG, stamped + '\n');
    } catch {
        // Logging must never take the loop down.
    }
}

function git(args, opts = {}) {
    return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8', ...opts}).trim();
}

function mdFiles(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter((f) => f.endsWith('.md'));
}

/**
 * Runs one headless Claude session.
 *
 * --dangerously-skip-permissions is required for unattended operation. The guardrails are not
 * the permission prompt but: the PreToolUse hook denying writes to the submodule and generated
 * files, the hard prohibitions in .claude-pipeline/AGENT.md, this loop never merging to main,
 * and the branch isolation below.
 */
function runAgent(role, prompt) {
    if (DRY_RUN) {
        log(`[${role}] DRY RUN - prompt follows:\n${prompt}\n`);
        return Promise.resolve({ok: true, stdout: '', timedOut: false});
    }

    return new Promise((resolve) => {
        const child = execFile(
            'claude',
            ['--dangerously-skip-permissions', '-p', prompt],
            {cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: AGENT_TIMEOUT_MS},
            (err, stdout, stderr) => {
                const timedOut = Boolean(err && err.killed);
                if (timedOut) log(`[${role}] TIMED OUT after ${AGENT_TIMEOUT_MS / 60000} minutes`);
                else if (err) log(`[${role}] exited non-zero: ${String(err.message).split('\n')[0]}`);
                if (stderr && stderr.trim()) log(`[${role}] stderr: ${stderr.trim().slice(0, 500)}`);
                resolve({ok: !err, stdout: stdout ?? '', timedOut});
            },
        );
        child.stdout?.on('data', (d) => process.stdout.write(d));
    });
}

const AGENT_CONTRACT = `
You are running unattended in a headless session. Read .claude-pipeline/AGENT.md and PROGRESS.md
first and follow them exactly.

Two rules override everything else:
- NEVER merge to main, force-push, or reset main.
- NEVER claim something is tested, verified, working, or fixed unless you actually ran a check
  that proves it. \`npm run verify\` proves it compiles, lints, and has no RAM-cost name
  collisions - it does NOT prove the behaviour is correct, because correctness here means
  matching a running Bitburner game and you cannot observe that. Say plainly what is unverified.
`.trim();

const ROLES = {
    architect: () => `${AGENT_CONTRACT}

You are the ARCHITECT. Propose exactly one small, high-value piece of work.

Read PROGRESS.md (especially "Autonomous scope" and "Next queue") and survey the codebase.
Choose something that can be fully verified by \`npm run verify\` alone - a refactor, dead code
removal, a type-safety improvement, a doc/comment correction, better checker coverage, or an
audit of src/WacnOS against the BitBurner-Src submodule. Do NOT propose anything whose
correctness depends on running the game.

Constraints: modifiable files <= 3. Prefer the smallest change that is genuinely worth making.
If nothing is worth doing right now, write NO file and say so - an empty cycle is a fine outcome
and far better than manufactured busywork.

Otherwise write ONE spec to .claude-pipeline/queue/1_proposed/<slug>.md containing: Title,
Motivation (why it is worth doing), Target files, Requirements, and Acceptance criteria stated
as commands that can actually be run headlessly.`,

    developer: (slug) => `${AGENT_CONTRACT}

You are the DEVELOPER. Implement the spec at .claude-pipeline/queue/1_proposed/${slug}.

1. git checkout main && git pull --ff-only 2>/dev/null || true, then create branch claude/${slug.replace(/\.md$/, '')}
2. Implement it. Match the style of the surrounding code. If you touch anything mirroring game
   behaviour, read the relevant file under BitBurner-Src/src/ rather than recalling it.
3. Run \`npm run verify\`. If it fails, fix and retry at most twice.
   - On a third failure: git checkout main, delete the branch, move the spec to
     .claude-pipeline/queue/3_blocked/ with the exact error, and STOP.
4. On success: commit on the branch with a message explaining WHY, then move the spec file from
   1_proposed/ to 2_implemented/ and append to it: what changed, the verify output, what remains
   UNVERIFIED, and the exact in-game commands a human should run to confirm it.

Leave the working tree clean. Do not merge.`,

    qa: (slug) => `${AGENT_CONTRACT}

You are QA. Review the change recorded in .claude-pipeline/queue/2_implemented/${slug}.

Check out its branch and:
1. Run \`npm run verify\` yourself. Do not trust the developer's report.
2. Read the actual diff (git diff main...HEAD). Look for: behaviour changes smuggled into a
   refactor, checks weakened to pass (disabled eslint rules, @ts-ignore, names added to
   ZERO_COST_ALLOWED), edits to src/SphyxOS/ or BitBurner-Src/, and any claim in the handoff note
   that the diff does not support.
3. Sanity-check the reasoning, not just the mechanics: does this change actually do what the spec
   asked, and is it worth keeping?

Append a section to the same file starting with exactly "QA VERDICT: PASS" or "QA VERDICT: FAIL",
followed by your findings. Be specific and be willing to fail it - a wrong change that passes
review is far more expensive here than a rejected one.`,

    organizer: () => `${AGENT_CONTRACT}

You are the ORGANIZER. Do NOT merge anything.

For each file in .claude-pipeline/queue/2_implemented/:
- QA VERDICT: PASS -> leave the branch for human review. If \`gh\` is available and no PR exists
  for that branch, open one whose body is the handoff note, clearly stating what is unverified and
  which in-game commands confirm it. Record it in PROGRESS.md under Completed as awaiting
  in-game verification.
- QA VERDICT: FAIL -> move the file to .claude-pipeline/queue/3_blocked/ with the reason. If the
  same slug has already failed twice, delete the branch and note in PROGRESS.md that the task was
  abandoned, so the loop stops retrying a bad idea.
- No verdict -> leave it alone for the next cycle.

Then update PROGRESS.md so the next session starts with an accurate picture: refresh In progress
and Next queue, and keep it short. Finish on main with a clean tree.`,
};

async function cycle(n, total) {
    log(`=== cycle ${n}/${total} ===`);

    // Circuit breaker: never start work on top of someone else's uncommitted changes.
    const status = git(['status', '--porcelain']);
    if (status) {
        log('ABORT: working tree is dirty. Commit or stash first:\n' + status);
        return false;
    }
    try {
        git(['checkout', 'main']);
    } catch {
        log('ABORT: could not check out main');
        return false;
    }

    await runAgent('architect', ROLES.architect());

    const proposed = mdFiles(PROPOSED);
    if (proposed.length === 0) {
        log('no proposal this cycle - nothing to implement');
        return true;
    }
    const slug = proposed[0];
    log(`proposal: ${slug}`);

    await runAgent('developer', ROLES.developer(slug));

    if (!mdFiles(IMPLEMENTED).includes(slug)) {
        log(`developer did not deliver ${slug} (see ${path.relative(ROOT, BLOCKED)} if blocked)`);
        return true;
    }

    await runAgent('qa', ROLES.qa(slug));
    await runAgent('organizer', ROLES.organizer());

    return true;
}

async function main() {
    for (const dir of [PROPOSED, IMPLEMENTED, BLOCKED]) mkdirSync(dir, {recursive: true});

    if (!existsSync(path.join(ROOT, '.claude-pipeline', 'AGENT.md'))) {
        log('ABORT: .claude-pipeline/AGENT.md is missing - the agents have no standing instructions');
        process.exit(2);
    }

    log(`starting pipeline: ${CYCLES} cycle(s)${DRY_RUN ? ' (dry run)' : ''}`);
    log('the organizer never merges to main; branches await human in-game verification');

    for (let i = 1; i <= CYCLES; i++) {
        let ok;
        try {
            ok = await cycle(i, CYCLES);
        } catch (err) {
            // One bad cycle must not end a long unattended run.
            log(`cycle ${i} threw: ${String(err).slice(0, 300)}`);
            ok = true;
        }
        if (!ok) {
            log('stopping early');
            break;
        }
        if (i < CYCLES) {
            log(`cooldown ${COOLDOWN_MS / 1000}s`);
            await new Promise((r) => setTimeout(r, COOLDOWN_MS));
        }
    }

    log('pipeline finished');
    const pending = mdFiles(IMPLEMENTED).length;
    const blocked = mdFiles(BLOCKED).length;
    log(`${pending} awaiting human verification, ${blocked} blocked`);
}

main();
