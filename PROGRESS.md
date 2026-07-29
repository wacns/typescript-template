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
- [x] RAM checker extended to destructuring bindings + named import specifiers
      (branch `claude/ram-check-destructuring-imports`, unmerged — renames `hack`/`grow` in
      hackloop.ts and `probe` in probe.ts; human should re-run `mem WacnOS/launcher/hackloop.js`,
      expected 6.35GB → ~6.10GB, and the self-test, before merging)
- [x] Game source moved to the `BitBurner-Src` submodule; hooks and skill repointed

## In progress

- [ ] Autopilot running unattended in BitNode 1 — first full autonomous ladder run

## Next queue

- [ ] BitVerse portal remains the only never-executed action (ends the node; needs a human)
- [ ] `dom/fiber.ts` `deepFind` is only exercised by travel; no other caller yet
- [ ] Casino farm loop has never run to the $10b cap in one go
- [ ] `daedalusRepMode: "donate"` path is unexercised (needs favor 150)

## Known-good baselines

Measured in-game, BitNode 1, so a regression is obvious:

| Script | RAM |
|---|---|
| `WacnOS/autopilot/daemon.js` | 7.35GB |
| `WacnOS/autopilot/selftest.js` | 6.60GB |
| `WacnOS/WLoader.js` | 6.25GB |
| `WacnOS/launcher/hackloop.js` | 6.35GB |
| `WacnOS/launcher/procure.js` | 2.25GB |
| `Workers/heavy-worker.js` | 3.45GB |

Self-test on a clean BitNode 1: **31 passed, 0 failed, 3 skipped**.
