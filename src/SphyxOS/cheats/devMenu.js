/** @param {NS} ns */
export async function main(ns) {
  globalThis.webpackRequire ?? webpackChunkbitburner.push([[-1], {}, w => globalThis.webpackRequire = w]);
  const skippedModuleIds = new Set(Object.keys(webpackChunkbitburner[0][1]));
  Object.keys(webpackRequire.m).filter(id => !skippedModuleIds.has(id)).forEach(k => Object.values(webpackRequire(k)).forEach(p => p?.toPage?.('Dev')));
}

/** @param {NS} ns */
/*
export async function main(ns) {
  globalThis.webpack_require ?? webpackChunkbitburner.push([[-1], {}, w => globalThis.webpack_require = w]);
  Object.keys(webpack_require.m).forEach(k => Object.values(webpack_require(k)).forEach(p => p?.toPage?.('Dev')));
}*/