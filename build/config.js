const fileSyncJson = require('../filesync.json');
const dist = fileSyncJson['scriptsFolder'];
const src = 'src';
const allowedFiletypes = fileSyncJson['allowedFiletypes'];

// Filetypes the *static* src -> dist mirror (build/watch.js's syncStatic) is responsible for: genuine
// non-code assets that tsc never touches. Deliberately excludes .js/.jsx/.ts/.tsx - those are tsc's
// domain (it compiles/copies them itself via allowJs), so the static mirror must never delete or copy
// them, or it'll fight tsc's own output (and, since it walks by extension, delete .jsx/.tsx-derived
// .js output it doesn't recognize as "still has a source").
const staticFiletypes = allowedFiletypes.filter((ext) => ext !== '.js');

module.exports = {
  dist,
  src,
  allowedFiletypes,
  staticFiletypes,
};
