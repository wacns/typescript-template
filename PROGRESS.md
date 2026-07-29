# PROGRESS

State handoff between autonomous sessions. A session starts by reading this file and ends by
updating it. Keep it short — it is context, not a changelog; `git log` is the changelog.

## Project shape

Bitburner Remote File API template. `src/` compiles to `dist/`, which `npm run watch` syncs into a
running game over WebSocket. `src/WacnOS/` is the main body of work: an autopilot that plays a
BitNode without Source-File 4, driving the game's real UI because no Netscript API exists for
joining factions, buying augmentations, travelling, or taking a BitVerse portal.

`src/SphyxOS/` is a vendored third-party toolkit — never edit it, `npm run update:sphyxos`
overwrites it wholesale. `BitBurner-Src/` is a git submodule holding the game's own source, used as
ground truth for formulas and API behaviour; a hook denies writes to it.

## The verification gap — read this before proposing work

`npm run verify` (tsc + eslint + RAM-collision check) is the only gate available without a running
game. It is necessary but **not sufficient**: correctness here means matching a live game's
behaviour, and the majority of real defects in this project have passed all three checks cleanly.

Actual examples, every one green under tsc and eslint:

| Defect | Consequence | Found by |
|---|---|---|
| Local names colliding with ns API names | +218GB phantom RAM, script unrunnable | running it in-game |
| `window.React` in `lib/react.ts` | +25GB to every UI script | in-game `mem` |
| Autopilot starting on an 8GB home | silent deadlock, nothing progresses | a fresh BitNode |
| Sidebar entries gated on progression | navigation fails on a new save | a fresh BitNode |
| Relaunch typing a command but not submitting | autopilot never resumes after install | a real prestige |
| Self-test leaking a fake status onto a port | loader shows a phantom running daemon | reading the UI |

The RAM-collision class is now caught by `npm run check:ram`. The rest are not mechanically
detectable. **Anything touching game behaviour needs a human running `WacnOS/autopilot/selftest.js`
in an actual game before it can be trusted.**

## Autonomous scope

Safe to do unattended (static analysis genuinely suffices):
- Refactors that do not change behaviour, dead code removal, comment and doc accuracy
- Type-safety improvements, narrowing `any`
- Auditing `src/WacnOS/` against `BitBurner-Src/` when the submodule updates, and reporting drift
- Extending `build/check-ram-collisions.js` coverage
- New self-test checks that are mechanically verifiable

Needs a human with the game open:
- Anything altering DOM selectors, the webpack bridge, or autopilot decision logic
- Anything whose success depends on RAM cost, timing, or game state
- Merging to `main`

## Completed

- [x] WacnOS autopilot: bridge, DOM layer, planner, decision engine, endgame, prestige resume
- [x] Verified in a real game: terminal injection, backdoor crawl, faction join, faction work,
      augmentation purchase, augmentation install, TOR + program purchase, casino RNG model
- [x] `npm run verify` gate, including the RAM-collision checker
- [x] RAM checker extended to destructuring bindings + named import specifiers; `hack`/`grow`
      renamed in hackloop.ts, `probe` in probe.ts. **Merged to main** (d4384dd) on a QA PASS
      verified in a real game (v3.0.1, fresh BitNode 1 via Playwright): phantom costs confirmed
      gone in-game (hackloop −0.25GB, probe −0.20GB vs a main build in the same game). Full QA
      record is in the merge commit's queue file.
- [x] Game source moved to the `BitBurner-Src` submodule; hooks and skill repointed

## In progress

- [ ] Autopilot running unattended in BitNode 1 — first full autonomous ladder run

## Next queue

- [ ] Audit `probe.js` (15.75GB measured, no prior baseline): checker skips member accesses, but
      the game bills property names too — `sleeve.travel` (4.00GB), `share` (2.40GB) and
      WLoader's `theme.hack` (0.10GB) may be phantoms of the same class the last merge removed
- [ ] Selftest M8 fails on a fresh 8GB home: selftest (6.75GB) leaves too little free to exec
      `helpers/getHacknetTotals.js` (2.60GB); also add a warnings slot to the tally banner
- [ ] BitVerse portal remains the only never-executed action (ends the node; needs a human)
- [ ] `dom/fiber.ts` `deepFind` is only exercised by travel; no other caller yet
- [ ] Casino farm loop has never run to the $10b cap in one go
- [ ] `daedalusRepMode: "donate"` path is unexercised (needs favor 150)

## Known-good baselines

Measured in-game, BitNode 1. Re-measured 2026-07-29 by QA in game v3.0.1 (fresh save); scripts
without a fresh figure keep the older one:

| Script | RAM |
|---|---|
| `WacnOS/autopilot/daemon.js` | 7.35GB |
| `WacnOS/autopilot/selftest.js` | 6.75GB |
| `WacnOS/WLoader.js` | 6.30GB |
| `WacnOS/launcher/hackloop.js` | 7.10GB |
| `WacnOS/autopilot/probe.js` | 15.75GB |
| `WacnOS/launcher/procure.js` | 2.25GB (stale, pre-v3.0.1) |
| `Workers/heavy-worker.js` | 3.45GB (stale, pre-v3.0.1) |

Self-test on a clean BitNode 1: **31 passed, 0 failed, 3 skipped** — but only with >8GB home
RAM. On a fresh 8GB home the expected tally is **29 passed, 1 failed (M8), 1 warning,
3 skipped**: the M8 hacknet check needs 2.60GB free that the selftest itself doesn't leave.
Reproduced identically on main and the feature branch, so it's environmental, not a regression.

## Needs human attention (2026-07-29 organizer session)

- Unexplained activity in the repo root, timeline 2026-07-29 (all local time):
  13:05 something staged a deletion of the queue file plus a .gitignore rule hiding
  `.claude-pipeline/queue/**/*.md` (QA caught and reverted it); 13:08
  `Autonomous-Enhancement-Claude.exe` (83MB) + `.pdb` appeared in the repo root; 13:13 that exe
  was started (PID 41836, parent explorer.exe — i.e. an interactive launch, plausibly a person
  at the machine) and immediately wrote an untracked stub `.claude-pipeline/PROGRESS.md`
  ("Continuous Pipeline Backlog & History") that shadows the real root PROGRESS.md. Nothing in
  the repo references this program. At ~13:16 it went further: it created and checked out a
  branch `claude/feature-latest` and staged its own code changes in the organizer's live
  checkout, mid-session, so the organizer's next commit (2de1819) landed on that branch carrying
  the foreign changes. At that point the organizer **stopped the process** (13:18; the .exe and
  .pdb are untouched on disk) — concurrent unauthorized git operations made finishing safely
  impossible otherwise. Its work is preserved unmerged on `claude/feature-latest`: a
  `hasSingularityAccess()` helper (`src/lib/singularity-access.ts`) refactoring deploy.ts and
  scan-install-backdoor.ts, plus a `queue/2_testing/task-latest.md` spec, and untracked
  `.claude-pipeline/state.json` + stub PROGRESS.md. If this agent is yours, know that it uses
  conflicting pipeline conventions and races the real one; its branch is unreviewed and
  unverified. If it is not yours, treat the binary as hostile and inspect before deleting.
- A human should decide deliberately whether queue files belong in git (they currently do, and
  the pipeline's paper trail depends on it).
