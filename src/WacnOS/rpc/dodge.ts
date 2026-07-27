import {NS} from "@ns";

/**
 * Execs `script` as a disposable (temporary, single-thread) process on home, waits for it to
 * write its result to its own pid-keyed port (via ns.atExit in the target script), and returns
 * that value. Keeps the calling script's own static RAM cost limited to whatever this file
 * itself references (ns.exec/ns.nextPortWrite/ns.readPort) - whatever expensive ns.* function
 * `script` calls internally (ns.formulas.*, ns.getServer, ...) never shows up in the caller's
 * RAM footprint, since the caller never imports it. WacnOS's version of SphyxOS's ramDodge/
 * ramDodgeLocal (src/SphyxOS/util.js).
 */
export async function dodge(ns: NS, script: string, args: (string | number | boolean)[] = []): Promise<unknown> {
    const pid = ns.exec(script, "home", {threads: 1, temporary: true}, ...args);
    if (pid === 0) throw new Error(`WacnOS dodge: failed to run ${script}`);
    await ns.nextPortWrite(pid);
    return ns.readPort(pid);
}
