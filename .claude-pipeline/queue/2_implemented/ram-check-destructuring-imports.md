# Extend RAM-collision checker to destructuring and import specifiers

## Motivation

`build/check-ram-collisions.js` exists because Bitburner bills a script's RAM by resolving every
identifier in its AST against the ns API tree by name. The game's walker
(`BitBurner-Src/src/Script/RamCalculations.ts`, `commonVisitors()` → `Identifier` visitor, ~line
407) records **every** `Identifier` node, and acorn-walk's base walker visits destructuring
patterns and import specifiers. The checker's `declarations()` regexes do not: they only match
plain `const foo` / `function foo` / `for (const foo` / object-key forms.

Two consequences:

1. **A live miss exists right now.** `src/WacnOS/launcher/hackloop.ts:153`:

   ```ts
   const [hack, weaken1, grow, weaken2] = capToBudget([...], totalThreads);
   ```

   `hack` (0.1GB) and `grow` (0.15GB) are billed ns names. hackloop.ts never calls `ns.hack` or
   `ns.grow` itself — it dispatches workers by string action name — so this is ~0.25GB of pure
   phantom RAM on a script whose measured baseline is 6.35GB. The checker passes it silently.
   (`weaken1`/`weaken2` don't collide; `growThreads`/`hackPercent` in the same file are
   zero-cost formulas names, already allowlisted.)

2. **The header comment overclaims.** The "WHAT IT CHECKS" block says parameters are covered;
   they are not, and neither are destructuring bindings nor import specifiers. A reader trusting
   that comment would assume more protection than exists.

A survey of all named imports and destructurings in `src/` (excluding SphyxOS/archive) found
`hackloop.ts` to be the only current hit, so the fix diff stays small.

## Target files

1. `build/check-ram-collisions.js` — extend `declarations()`, correct the header comment
2. `src/WacnOS/launcher/hackloop.ts` — rename the two flagged locals

## Requirements

1. In `declarations()`, additionally capture:
   - **Object/array destructuring bindings** in `const`/`let`/`var` (including `for (const ... of`)
     — e.g. `const {a, b: c} = x` flags `a`, `b`, and `c` (renamed property keys are still
     Identifier nodes in the AST and billed too); `const [a, , b] = x` flags `a` and `b`. Handle
     default values (`{a = 1}`) and rest elements (`...rest`). Nested destructuring may be handled
     with the same one-level heuristic rigor as the rest of the file — this is a regex checker,
     not a parser; catching the flat common case is the goal.
   - **Named import specifiers** — `import {a, b as c} from "..."` flags `a`, `b`, and `c`.
     Skip `import type {...}` lines and `type X` specifiers: type-only imports are erased by tsc
     and never reach the game's AST.
2. Correct the "WHAT IT CHECKS" header comment so it lists exactly what is covered, and states
   explicitly that function parameters are **not** covered (out of scope here — TS type
   annotations make parameter-name extraction regex-hostile; note it as a known gap instead).
3. Rename `hack` → `hackT` and `grow` → `growT` (matching the file's existing `rawHack` style) in
   `hackloop.ts:153` and their uses (lines 162, 164, 168, and the `phaseLabel` template).
   Behaviour-neutral rename; touch nothing else in the file.
4. If the extended checker flags anything else in `src/`, and fixing it would push the diff past
   3 files, stop and record the extra hits in the handoff note instead of fixing them.
5. Do not add anything to `ZERO_COST_ALLOWED`.

## Acceptance criteria

All runnable headlessly, in order:

1. Regression demo — the new coverage actually fires:
   ```
   node -e "require('fs').writeFileSync('src/__ramcheck_fixture__.ts', 'const {installAugmentations} = {} as never;\nconst [purchaseServer] = [] as never[];\n')"
   node build/check-ram-collisions.js        # must exit 1, naming installAugmentations and purchaseServer
   node -e "require('fs').unlinkSync('src/__ramcheck_fixture__.ts')"
   ```
2. `node build/check-ram-collisions.js` on the final tree exits 0 (i.e. the hackloop renames
   satisfy the extended check, and nothing else in src/ trips it).
3. `npm run verify` exits 0.

## Unverifiable here

The actual in-game RAM drop on `WacnOS/launcher/hackloop.js` (expected: 6.35GB → ~6.10GB) can
only be confirmed by a human running `mem WacnOS/launcher/hackloop.js` in a live game. The rename
itself is behaviour-neutral and fully covered by `npm run verify`.

---

## Implementation handoff (2026-07-29, branch `claude/ram-check-destructuring-imports`, commit 8042178)

### What changed

1. `build/check-ram-collisions.js` — `declarations()` now also captures:
   - destructuring bindings in `const`/`let`/`var` (incl. `for (const ... of`): object and array
     patterns, renamed property keys (`{a: b}` flags both), defaults stripped so their value
     expressions aren't flagged, rest elements, nested patterns flattened one level;
   - named import specifiers, with `import type {...}` lines and `type X` specifiers skipped.
   The "WHAT IT CHECKS" header now lists exactly this coverage and states explicitly that
   function parameters are NOT covered (known gap — TS annotations are regex-hostile).
2. `src/WacnOS/launcher/hackloop.ts` — `hack` → `hackT`, `grow` → `growT` in the batch
   destructuring at line 153, their dispatch uses, and the `phaseLabel` template. Nothing else.
3. `src/WacnOS/autopilot/probe.ts` — **extra hit the spec's survey missed**, found by the
   extended checker itself: `for (const [label, probe] of checks)` in `reportSelectors()`
   (line 553). `probe` is a billed ns name (`RamCostConstants.Scan` = 0.2GB, confirmed at
   `BitBurner-Src/src/Netscript/RamCostGenerator.ts:244`). Renamed to `resolve` (confirmed
   absent from RamCostGenerator.ts). Diff stays at exactly 3 files, within the spec's limit.

Confirmed against game source before implementing: the `Identifier` visitor in
`commonVisitors()` (`BitBurner-Src/src/Script/RamCalculations.ts:407`) records every
Identifier node unconditionally, so destructuring bindings and import specifiers really are
billed. Nothing added to `ZERO_COST_ALLOWED`.

### Acceptance criteria results (all run headlessly)

1. Regression fixture: checker exited 1, naming `installAugmentations` (80GB) and
   `purchaseServer` (2.25GB) — and additionally the then-unfixed `probe` hit, proving the new
   destructuring coverage fires on real code. Fixture deleted afterwards.
2. `node build/check-ram-collisions.js` on the final tree:
   `check-ram-collisions: OK (checked 409 costly ns names)` — exit 0.
3. `npm run verify`: exit 0 (tsc clean; eslint 0 errors / 8 pre-existing warnings in files this
   change does not touch; RAM check OK).

### UNVERIFIED

- The actual in-game RAM drop on `WacnOS/launcher/hackloop.js` (expected 6.35GB → ~6.10GB).
  Nothing here observes a running game; `npm run verify` proves compile/lint/name-collision
  cleanliness only.
- Any in-game RAM change to `WacnOS/autopilot/probe.js` from the `probe` → `resolve` rename
  (expected: −0.2GB if the phantom cost was being billed; no measured baseline exists for
  probe.js in PROGRESS.md).
- Runtime behaviour of the renamed code paths (batch dispatch in hackloop, `--selectors` report
  in probe). Both renames are mechanical and type-checked, but not exercised in a game.

### In-game commands for a human to confirm

```
mem WacnOS/launcher/hackloop.js       expect ~6.10GB (baseline was 6.35GB)
mem WacnOS/autopilot/probe.js         expect 0.2GB lower than before this change
run WacnOS/launcher/hackloop.js       BATCH phase label still shows h/w/g/w counts
run WacnOS/autopilot/probe.js --selectors   selector health report renders as before
run WacnOS/autopilot/selftest.js      expect 31 passed, 0 failed, 3 skipped
```

---

QA VERDICT: PASS

QA session 2026-07-29, branch at e4ea075, verified in a real game (Bitburner v3.0.1 web,
throwaway fresh save in Playwright, synced via `pipeline/qa-filesync.mjs` on port 12526).
One environment note: Chrome now gates ws:// connections from public https pages to localhost
behind the Local Network Access permission; the game's Remote API hangs in CONNECTING until
`context.grantPermissions(['local-network-access'])` is issued. Future QA sessions will hit this.

### Independently re-run checks

- `npm run verify`: exit 0 (tsc clean, eslint 0 errors / 8 pre-existing warnings, RAM check
  `OK (checked 409 costly ns names)`). Matches the developer's report.
- Regression fixture from the acceptance criteria: exit 1, naming `installAugmentations` (80GB)
  and `purchaseServer` (2.25GB). New destructuring/import coverage fires. Fixture deleted.
- Diff review (`git diff main...HEAD`): 3 code files exactly as described. No edits to
  SphyxOS/BitBurner-Src/dist, no `ZERO_COST_ALLOWED` additions, no eslint-disable/@ts-ignore,
  no behaviour change beyond the three renames. Confirmed `hackT`, `growT`, `resolve` are all
  absent from `BitBurner-Src/src/Netscript/RamCostGenerator.ts`.

### Selftest tally (this branch, fresh BitNode 1 save)

- `--verbose`: 29 passed, 1 failed, 1 warning, 3 skipped
- `--active`:  32 passed, 1 failed, 1 warning, 4 skipped
- The single FAIL (M8 "hacknet totals readable") and the WARN (home RAM) are **pre-existing and
  environmental, not caused by this branch**: I rebuilt dist from main (ab58669) into the same
  game and got an identical 29/1/1/3 with the same M8 failure. Cause: on a fresh 8GB home the
  selftest itself (6.75GB) leaves 1.25GB free, and `helpers/getHacknetTotals.js` needs 2.60GB,
  so the dodge exec cannot start. The PROGRESS.md baseline of 31/0/3 evidently came from a save
  with more home RAM.

### RAM deltas (in-game `mem`, main build vs branch build, same game)

| Script | main | branch | delta |
|---|---|---|---|
| `WacnOS/launcher/hackloop.js` | 7.35GB (incl. phantom `hack` 0.10 + `grow` 0.15) | 7.10GB (phantoms gone) | −0.25GB |
| `WacnOS/autopilot/probe.js` | 15.95GB (incl. phantom `dnet.probe` 0.20) | 15.75GB (phantom gone) | −0.20GB |
| `WacnOS/autopilot/daemon.js` | — | 7.35GB | matches baseline |

The spec's "6.35GB → ~6.10GB" expectation is off because the PROGRESS.md hackloop baseline is
stale: commits `1f26d48`/`2b27cfa` on main added four real 1.00GB analyze calls
(`weakenAnalyze`, `growthAnalyze`, `growthAnalyzeSecurity`, `hackAnalyzeSecurity`) after the
baseline was recorded. Main itself measures 7.35GB in this game; the branch's −0.25GB drop is
exactly the phantom cost the rename was meant to remove. No script measured higher on the
branch than on main.

### Observed running

- Remote API connect, full file sync, both selftest modes end-to-end (active mode navigated
  every page, injected `expr 31337` into the terminal twice, armed/fired the relaunch timer).
- `run WacnOS/launcher/hackloop.js` crashes at startup on this save: dodge cannot exec
  `helpers/rootNewServers.js` (5.05GB; only 0.90GB free beside hackloop's 7.10GB). Pre-existing
  on any fresh 8GB home and strictly worse on main (0.65GB free); the crash is at hackloop.js:64,
  before the renamed batch code at line 153. Not caused by this change.

### Still unverified

- The renamed batch-dispatch path (BATCH phase label, h/w/g/w counts) was never executed:
  hackloop cannot bootstrap on an 8GB home on either branch. Needs a save with ≥16GB home.
- `probe.js --selectors` (renamed `resolve` loop) was never executed: probe.js needs 15.75GB.
  Both renames are mechanical, type-checked, and their `mem` breakdowns confirm the identifiers
  resolved as intended, but runtime behaviour is unexercised.

### Follow-ups noticed (not blocking this branch)

- PROGRESS.md baselines for hackloop (6.35GB), selftest (6.60GB), WLoader (6.25GB) are stale;
  current main measures 7.35 / ~6.75+ / 6.30 in game v3.0.1. Worth re-baselining after merge.
- `WLoader.js` carries a pre-existing 0.10GB phantom: `theme.hack` (WLoader.tsx:291 etc.) is a
  member access, which the checker deliberately skips, but the game bills the `hack` property
  name as `ns.hack`. Same class of issue for probe.js's `sleeve.travel` (4.00GB!) and `share`
  (2.40GB) entries if those are also phantoms — probe.js has no baseline to compare against and
  its size (15.75GB) deserves its own audit.
- Selftest tally line does not count warnings in the header banner ("31 passed, 0 failed,
  3 skipped" in PROGRESS.md has no warning slot); baseline format should include it.

### Session anomaly (for the Organizer and the human — read before trusting the tree)

Mid-QA-session, uncommitted git state appeared that neither this session nor `pipeline/run.mjs`
created: a staged deletion (`git rm --cached`-style) of THIS file, plus a staged .gitignore edit
adding `.claude-pipeline/queue/**/*.md` (.gitignore mtime 13:05 local, while this QA session was
the only pipeline agent running; architect and developer had already exited and the tree was
clean at QA start). That change would have silently removed the queue paper trail from version
control. Neither rule exists in main's or this branch's committed .gitignore, and the pipeline's
design depends on queue files being committed. I restored the index and .gitignore to HEAD and
committed this QA note normally. Candidate actors on the machine at the time: the open WebStorm
IDE (git integration + MCP servers) or the Claude desktop app; could not be determined. A human
should decide deliberately whether queue files belong in git — not inherit it as a side effect.
