import {NS} from "@ns";

/** Disposable wrapper around ns.getServer, exec'd via rpc/dodge so hackloop.ts never pays its RAM cost statically. */
export async function main(ns: NS): Promise<void> {
    const hostname = ns.args[0] as string;
    const server = ns.getServer(hostname);
    ns.atExit(() => ns.writePort(ns.pid, server));
}
