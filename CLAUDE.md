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

## Style

ESLint is configured (`eslint:recommended` + `@typescript-eslint/recommended`, no custom rules) — run with `npm run lint`. No Prettier config exists.

Note: `npm run lint` currently flags `no-constant-condition` on the intentional `while (true)` loop in `src/HackRelated/worker.ts` (a long-running Netscript worker loop, not a bug).
