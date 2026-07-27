const fs = require('node:fs');
const path = require('node:path');
const syncDirectory = require('sync-directory');
const fg = require('fast-glob');
const chokidar = require('chokidar');
const { src, dist, staticFiletypes } = require('./config');

/** Extensions tsc (allowJs + jsx: "react") compiles/copies to a same-named .js in dist. */
const TS_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.jsx', '.js'];

/** True if any of src/<relative-without-.js-ext><TS_SOURCE_EXTENSIONS> exists for a dist .js file. */
function hasMatchingSourceFile(distRelativeJsPath) {
  const withoutExt = distRelativeJsPath.replace(/\.js$/, '');
  return TS_SOURCE_EXTENSIONS.some((ext) => fs.existsSync(path.resolve(src, `${withoutExt}${ext}`)));
}

/** Format dist path for printing */
function normalize(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Sync static files.
 * Include init and watch phase.
 */
async function syncStatic() {
  return syncDirectory.async(path.resolve(src), path.resolve(dist), {
    exclude: (file) => {
      const { ext } = path.parse(file);
      return ext && !staticFiletypes.includes(ext);
    },
    async afterEachSync(event) {
      // log file action
      let eventType;
      if (event.eventType === 'add' || event.eventType === 'init:copy') {
        eventType = 'changed';
      } else if (event.eventType === 'unlink') {
        eventType = 'deleted';
      }
      if (eventType) {
        let relative = event.relativePath;
        if (relative[0] === '\\') {
          relative = relative.substring(1);
        }
        console.log(`${normalize(relative)} ${eventType}`);
      }
    },
    watch: true,
    deleteOrphaned: true,
  });
}

/**
 * Sync ts script files.
 * Init phase only.
 */
async function initTypeScript() {
  const distFiles = await fg(`${dist}/**/*.js`);
  for (const distFile of distFiles) {
    // search existing source file (.ts/.tsx/.jsx/.js) in src
    const relative = path.relative(dist, distFile);
    if (!hasMatchingSourceFile(relative)) {
      await fs.promises.unlink(distFile);
      console.log(`${normalize(relative)} deleted`);
    }
  }
}

/**
 * Sync ts script files.
 * Watch phase only.
 */
async function watchTypeScript() {
  chokidar.watch(`${src}/**/*.{ts,tsx,jsx,js}`).on('unlink', async (p) => {
    // called on any tsc-managed source file (.ts/.tsx/.jsx/.js) being deleted - staticFiletypes no
    // longer includes .js, so this is the only place plain .js source deletions get cleaned up too
    const relative = path.relative(src, p).replace(/\.(ts|tsx|jsx|js)$/, '.js');
    const distFile = path.resolve(dist, relative);
    // only delete if no other source extension still maps to the same dist file
    if (fs.existsSync(distFile) && !hasMatchingSourceFile(relative)) {
      await fs.promises.unlink(distFile);
      console.log(`${normalize(relative)} deleted`);
    }
  });
}

/**
 * Sync ts script files.
 * Include init and watch phase.
 */
async function syncTypeScript() {
  await initTypeScript();
  return watchTypeScript();
}

console.log('Start watching static and ts files...');
syncStatic();
syncTypeScript();
