import {NS} from "@ns";

/**
 * tail requires exact args to match a script by name, which is useless when you don't know
 * what it's running with. ps() gives the real args-agnostic identity (pid), so look the
 * script up by filename there and open its tail by pid instead.
 */
export async function main(ns: NS) {
    const [filename, host] = ns.args as [string, string?];
    if (!filename) {
        ns.tprint("Usage: run find-tail.js <filename> [host]");
        return;
    }

    const proc = ns.ps(host ?? "home").find((p) => p.filename === filename);
    if (!proc) {
        ns.tprint(`No running process named ${filename} found on ${host ?? "home"}.`);
        return;
    }

    ns.tprint(`Found ${filename} as pid ${proc.pid} (args: ${JSON.stringify(proc.args)}). Opening tail.`);
    ns.ui.openTail(proc.pid);
}
