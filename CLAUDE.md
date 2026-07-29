# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

This is the Bitburner Remote File API (RFA) TypeScript template. It compiles scripts written in `src/` and syncs the compiled output into a running instance of the game Bitburner (Web or Steam/Electron) over a local WebSocket. There is no test suite, no CI, and no server/app to run outside the game itself — "running" this project means starting the sync workflow and connecting it to Bitburner.

## Dev workflow

`npm run watch` starts everything needed: it initializes (`watch:init`), then runs three processes concurrently (`watch:all`):
- `watch:transpile` — `tsc -w` compiling `src/` → `dist/`
- `watch:local` — local dist watcher
- `watch:remote` — `bitburner-filesync`, which pushes `dist/` into the game over the port configured in `filesync.json` (currently `12525`)

This must stay running in the background while working. After starting it, the port it logs must be pasted into Bitburner's in-game Remote API settings, then connected manually — there is no way to verify a script landed in-game without that manual connect step.

`dist/` (compiled JS), not `src/`, is what gets pushed to the game.

## Import rules (game-enforced, not just TS convention)

Import paths must be:
- Absolute from `src/` root (no leading `src/`)
- No leading slash
- No file extension

```ts
import { helperFunction } from "lib/helpers";
```

Deviating from this breaks resolution in-game even if `tsc` compiles fine locally.

Path aliases (`tsconfig.json`): `@ns` → `NetscriptDefinitions.d.ts`, `@react` → `src/lib/react.ts`.

## Script shape

Every script exports `async function main(ns: NS)`, importing `NS` from `@ns`. Game APIs are called via `ns.*` (e.g. `ns.hack`, `ns.grow`, `ns.weaken`, `ns.exec`, `ns.scp`, `ns.tprint`, `ns.flags`). See `src/HackRelated/worker.ts` and `src/Dispatchers/deploy.ts` for the established pattern of a worker script plus a dispatcher that deploys it across servers.

React can be used in `.tsx` scripts via `ns.printRaw()`, importing `React` from `@react`.

## NetscriptDefinitions.d.ts gotcha

`NetscriptDefinitions.d.ts` is gitignored and must exist locally (even as an empty file) before running the sync — `filesync.json` has `definitionFile.update: true`, so the game overwrites it with fresh API typings on every connection. Don't hand-edit it; treat it as generated.

## Verification

`npm run verify` = `tsc --noEmit` + `eslint src` + `node build/check-ram-collisions.js`. It should exit 0; treat any failure as blocking.

**It is necessary but not sufficient.** There is no test suite because correctness here means matching a running game's behaviour. Most real defects in this project have passed all three checks cleanly — RAM name-collisions, a 25GB `window` token, a startup deadlock, progression-gated selectors, a relaunch that typed a command without submitting it. The real test suite is `WacnOS/autopilot/selftest.js`, and it only runs inside Bitburner. Never call a behavioural change verified on the strength of `npm run verify` alone.

`npm run check:ram` guards a trap specific to this game: Bitburner bills script RAM by resolving identifiers against the whole `ns` API tree **by name, ignoring namespaces**, so a local function named `workForFaction` silently costs 48GB. Before naming anything after a game concept, check `BitBurner-Src/src/Netscript/RamCostGenerator.ts`.

## Style

ESLint is configured (`eslint:recommended` + `@typescript-eslint/recommended`). Vendored `src/SphyxOS/`, `src/Loader.js` and `src/Dispatchers/archive/` are ignored; long-running daemons have `no-constant-condition` relaxed via an override, since `while (true)` with an inner `await` is the correct shape for a Netscript worker. No Prettier config exists.

## Autonomous work

`.claude-pipeline/AGENT.md` holds the standing instructions for unattended sessions, and `PROGRESS.md` is the state handoff between them. Autonomous sessions work on `claude/<slug>` branches and never merge to `main` — the merge gate is a human running the self-test in a real game.
