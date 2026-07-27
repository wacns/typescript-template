import { NS } from "@ns";

type BridgeServer = { hostname: string; backdoorInstalled?: boolean };
type BridgeRouter = { toPage: (page: string, options?: unknown) => void };
type GetAllServersFn = (showDarkweb?: boolean) => BridgeServer[];
type GetServerFn = (hostname: string) => BridgeServer | null;

// Headless equivalent of "Quick w0rld_d34m0n" (Cheats -> NOT the Dev Menu -> General, from the
// vendored SphyxOS toolkit). Flags w0r1d_d43m0n as backdoored (best-effort, same optional-chained
// leniency as the in-game button) and jumps into the quick BitVerse flume, with no tail window opened.
export async function main(ns: NS): Promise<void> {
  const g = globalThis as any;
  g.webpackRequire ?? g.webpackChunkbitburner.push([[-1], {}, (w: unknown) => (g.webpackRequire = w)]);
  const skippedModuleIds = new Set(Object.keys(g.webpackChunkbitburner[0][1]));
  const compact = (fn: (...args: unknown[]) => unknown) => Function.prototype.toString.call(fn).replace(/\s+/g, "");

  let Router: BridgeRouter | undefined;
  let GetAllServers: GetAllServersFn | undefined;
  let GetServer: GetServerFn | undefined;

  for (const id of Object.keys(g.webpackRequire.m).filter((moduleId: string) => !skippedModuleIds.has(moduleId))) {
    let mod;
    try { mod = g.webpackRequire(id); } catch { continue; }
    if (!mod) continue;
    for (const value of Object.values(mod) as unknown[]) {
      if (!Router && (value as any)?.page && (value as any)?.toPage) Router = value as BridgeRouter;
      if (typeof value !== "function") continue;
      const code = compact(value as (...args: unknown[]) => unknown);
      // GetAllServers: `for (const [host, server] of AllServers.entries()) { ... servers.push(server) ... server instanceof DarknetServer }`
      if (!GetAllServers && code.includes(".entries())") && code.includes("push(") && code.includes("instanceof")) GetAllServers = value as unknown as GetAllServersFn;
      // Fallback: sibling of AddToAllServers, returns `X ?? null`.
      if (!GetServer && code.includes("Tryingtoaddaserverwithanexisting")) {
        for (const inner of Object.values(mod) as unknown[]) {
          if (typeof inner === "function" && compact(inner as (...args: unknown[]) => unknown).includes("??null")) GetServer = inner as unknown as GetServerFn;
        }
      }
    }
    if (Router && (GetAllServers || GetServer)) break;
  }

  if (!Router) {
    ns.tprint("ERROR quickWD: Router not found via webpack bridge.");
    return;
  }

  const wd = GetAllServers ? GetAllServers(true).find((s) => s.hostname === "w0r1d_d43m0n") : GetServer?.("w0r1d_d43m0n");
  if (wd) wd.backdoorInstalled = true;
  else ns.tprint("WARN quickWD: could not flag w0r1d_d43m0n as backdoored; proceeding to BitVerse anyway.");

  Router.toPage("BitVerse", { flume: false, quick: true });
}
