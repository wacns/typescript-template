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
 * THE MERGE GATE IS A RUNNING GAME, NOT tsc. QA drives Playwright against a throwaway Bitburner
 * instance fed by a second filesync on port 12526, runs the in-game self-test, and compares
 * measured RAM against the baselines in PROGRESS.md. The Organizer merges only on a verdict backed
 * by a real selftest tally.
 *
 * That indirection is the whole point. Every serious defect this project has hit - RAM name
 * collisions costing 218GB, a startup deadlock, a relaunch that typed a command without submitting
 * it, batches allocating zero hack threads - was green under tsc, eslint AND the RAM checker, and
 * only visible in a running game. A loop gated on static analysis would have shipped all of them.
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

You are QA. Verify the change recorded in .claude-pipeline/queue/2_implemented/${slug} - including
IN A RUNNING GAME. You have Playwright browser tools; use them.

Check out its branch, then:

1. \`npm run verify\`. Do not trust the developer's report; run it yourself.

2. Read the diff (git diff main...HEAD). Reject: behaviour changes smuggled into a refactor,
   checks weakened to pass (disabled eslint rules, @ts-ignore, names added to ZERO_COST_ALLOWED),
   edits to src/SphyxOS/ or BitBurner-Src/, and any claim the diff does not support.

3. IN-GAME VERIFICATION. Build and run it against a real game:
   a. \`npx tsc\` so dist/ matches the branch.
   b. Start the QA sync server in the background: \`node pipeline/qa-filesync.mjs\`
      It serves dist/ on port 12526. Do NOT use 12525 - that is the developer's live game.
   c. Playwright: navigate to https://bitburner-official.github.io/
      This is a THROWAWAY game in Playwright's own browser profile, not the developer's save.
      Dismiss any intro dialog.
   d. Options -> Remote API -> set port 12526 -> Connect. Files sync in.
   e. In the terminal run: \`run WacnOS/autopilot/selftest.js --verbose\`
      Read the whole output. Then \`run WacnOS/autopilot/selftest.js --active\`.
   f. \`mem\` the scripts your change could affect and compare against the baseline table in
      PROGRESS.md. An unexplained RAM increase is a FAIL - it usually means a name collision.
   g. If the change touches the hacking loop, autopilot, or DOM layer, actually watch it run for
      a minute and confirm it does something. A loop that reports a healthy phase while earning
      nothing has happened here before.

   You have the game's own source at BitBurner-Src/. When behaviour looks wrong, read the
   relevant file there and determine what the game actually does rather than guessing.

4. Kill the qa-filesync process and close the browser when done.

Append to the same file a section starting with exactly "QA VERDICT: PASS" or "QA VERDICT: FAIL",
then: the selftest tally (passed/failed/skipped), any RAM deltas, what you observed running, and
anything still unverified. Be willing to fail it. A selftest that cannot run at all is a FAIL,
not a skip.`,

    organizer: () => `${AGENT_CONTRACT}

You are the ORGANIZER.

For each file in .claude-pipeline/queue/2_implemented/:

- QA VERDICT: PASS -> merge its branch into main with --no-ff, then delete the branch. Before
  merging, confirm for yourself that the QA note actually contains a selftest tally from a real
  game. A PASS with no evidence of the game having run is NOT a pass: treat it as FAIL, because
  the whole point of that step is that static checks do not catch this project's real defects.
  After merging, run \`npm run verify\` on main. If it fails, revert the merge commit immediately
  (git revert -m 1 <sha>) and record what happened - main must always be green.

- QA VERDICT: FAIL -> move the file to .claude-pipeline/queue/3_blocked/ with the reason. If the
  same slug has already failed twice, delete its branch and note in PROGRESS.md that the task was
  abandoned, so the loop stops retrying a bad idea.

- No verdict -> leave it for the next cycle.

Then update PROGRESS.md so the next session starts with an accurate picture: move finished work to
Completed, refresh In progress and Next queue, and update the RAM baseline table if a merge
changed any measured figure. Keep it short. Finish on main with a clean tree.`,
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

    // A dry run writes no proposal, so the real flow would stop here - which would defeat the
    // point of inspecting the prompts before committing to a run. Show all four against a
    // placeholder instead.
    if (DRY_RUN) {
        const sample = 'example-task.md';
        await runAgent('developer', ROLES.developer(sample));
        await runAgent('qa', ROLES.qa(sample));
        await runAgent('organizer', ROLES.organizer());
        return true;
    }

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
    log('merge gate: QA runs the self-test in a real game (Playwright + filesync on 12526)');

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
