import {NS} from "@ns";

/**
 * Isolates ns.formulas.hacking.growThreads's RAM cost (requires Formulas.exe) from the caller.
 * Returns 0 if Formulas.exe is missing or the calculation throws, so hackloop.ts can fall back
 * to a flat grow-thread guess instead.
 */
export async function main(ns: NS): Promise<void> {
    const hostname = ns.args[0] as string;
    let threads = 0;
    if (ns.fileExists("Formulas.exe", "home")) {
        try {
            const server = ns.getServer(hostname);
            const player = ns.getPlayer();
            threads = Math.max(0, Math.ceil(ns.formulas.hacking.growThreads(server, player, server.moneyMax ?? 0)));
        } catch {
            threads = 0;
        }
    }
    ns.atExit(() => ns.writePort(ns.pid, threads));
}
