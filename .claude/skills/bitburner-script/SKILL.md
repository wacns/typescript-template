---
name: bitburner-script
description: Scaffold a new Bitburner Netscript TypeScript file in this repo (src/) with correct imports, main() signature, and file placement. Use when the user asks to create a new Bitburner script, hacking script, or automation for the game.
---

Create a new script under `src/` following this template's conventions:

```ts
import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    // implementation
}
```

Rules to follow:
- Import `NS` from `@ns` (never a relative path to `NetscriptDefinitions.d.ts`).
- Export a named `async function main(ns: NS)` — not a default export.
- Place the file under `src/`, in a subfolder grouped by purpose, matching the existing layout: `src/HackRelated/` and `src/Workers/` for scripts deployed to run on remote servers, `src/Dispatchers/` for scripts that decide targets and deploy workers across the botnet, `src/Utils/` for one-off utilities, `src/lib/` for shared helpers.
- Any `import` of another file in this repo must be absolute from `src/` root, no leading slash, no extension (e.g. `import { helperFunction } from "lib/helpers";`) — see `src/HackRelated/worker.ts` for a script pattern and `src/Dispatchers/deploy.ts` for a dispatcher pattern that deploys a worker script across servers via `ns.exec`.
- Use `ns.*` APIs for all game interaction (`ns.hack`, `ns.grow`, `ns.weaken`, `ns.exec`, `ns.scp`, `ns.tprint`, `ns.args`, etc.) — never invent APIs; check `NetscriptDefinitions.d.ts` for the real signature if unsure.
- Don't add a test file or wire anything into `npm` scripts — this repo has no test suite; verification happens by running `npm run watch` and observing the script in-game.
