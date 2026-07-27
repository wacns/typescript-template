---
name: bitburner-mechanics
description: Look up exact Bitburner game mechanics, formulas, and Netscript API signatures from the game's own source code before implementing non-trivial automation (hacking math, Corporation, Bladeburner, Gang, Stock Market, Hacknet, Sleeve, Singularity, Go/IPvGO, skill/exp formulas). Use whenever a script needs to replicate or predict a game calculation, or when unsure of an ns.* function's real signature/behavior — never guess these from training data, the game's numbers change between versions.
---

## Why this exists

Training data about Bitburner formulas goes stale — the game changes constants and
formulas across versions. This repo has the actual game source checked out locally at
`All-Game-Files-And-Documentations/bitburner-src-dev/`. It is the ground truth. Read it
instead of recalling remembered formulas whenever a script's correctness depends on
matching the game's real math or a function's real signature/behavior.

Two independent sources live there, use whichever fits the question:
- `src/` — the actual TypeScript implementation (exact formulas, constants, edge cases).
- `markdown/bitburner.*.md` — generated API docs, one file per class/method/property
  (~1557 files). Fastest way to check a single `ns.*` function's signature, params,
  and description without reading implementation code.

This directory is reference material only — never copy it into `src/` (the template's
own script folder), never edit it, and don't import from it. It exists purely for you
to read while writing this repo's own Netscript scripts under `src/`.

## Where to look, by topic

Grep or Read directly — don't explore blindly, go straight to these paths:

| Topic | Source implementation | API docs glob |
|---|---|---|
| Hacking success/time/money/exp formulas | `src/Hacking.ts` | `markdown/bitburner.ns.hack*.md`, `bitburner.hackingformulas*.md` |
| Player skills/exp curves, multipliers | `src/PersonObjects/Player/`, `src/PersonObjects/formulas/`, `src/PersonObjects/Skills.ts`, `src/PersonObjects/Multipliers.ts` | `bitburner.player*.md` |
| `ns.formulas.*` (in-game Formulas API) | `src/NetscriptFunctions/Formulas.ts` | `bitburner.formulas.md`, `bitburner.*formulas*.md` |
| Corporation (divisions, materials, products, research) | `src/Corporation/*.ts`, `src/Corporation/helpers.ts` | `bitburner.corporation*.md` |
| Bladeburner (actions, success chance, skills) | `src/Bladeburner/Bladeburner.ts`, `src/Bladeburner/Formulas.ts`, `src/Bladeburner/Actions/` | `bitburner.bladeburner*.md` |
| Gang (tasks, ascension, territory, respect/money) | `src/Gang/*.ts`, `src/Gang/formulas/` | `bitburner.gang*.md` |
| Stock Market | `src/StockMarket/*.ts` | `bitburner.stockmarket*.md`, `bitburner.tix*.md` |
| Hacknet (nodes/servers cost & production) | search `src/Hacknet/` | `bitburner.hacknet*.md` |
| Sleeves | `src/PersonObjects/Sleeve/` | `bitburner.sleeve*.md` |
| Singularity (`ns.singularity.*`) | `src/NetscriptFunctions/Singularity.ts` | `bitburner.singularity*.md` |
| Go / IPvGO | `src/Go/` | `bitburner.go*.md` |
| Infiltration | `src/Infiltration/` | `bitburner.infiltration*.md` |
| Grafting | `src/PersonObjects/Grafting/` | `bitburner.grafting*.md` |
| Server growth/security/money mechanics | `src/Server/` | `bitburner.server*.md` |
| Global constants (RAM costs, base rates, caps) | `src/Constants.ts` | — |
| Full `ns.*` namespace map | — | `bitburner.ns.md` (index of every namespace) |

## Workflow

1. Identify the game mechanic the script depends on.
2. Grep the relevant `src/` file(s) for the actual formula/constant, or read the
   matching `markdown/bitburner.<namespace>.<method>.md` for an exact signature.
3. Port the formula/logic into the script faithfully — cite the source file/line in a
   comment only if the constant or formula is non-obvious and would otherwise look
   arbitrary.
4. If the mechanic isn't found under the expected path, `Grep` across
   `All-Game-Files-And-Documentations/bitburner-src-dev/src` for the relevant
   identifier before falling back to general knowledge.
5. Still write scripts under this repo's own `src/`, following the `bitburner-script`
   skill's conventions — this skill is only for looking up ground truth, not for where
   to place files.
