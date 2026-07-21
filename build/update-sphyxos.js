// Pulls the latest SphyxOS release manifest and writes it into src/, mirroring what SphyxOS's own
// in-game updater does (same SphyxOSHash.txt / SphyxOS.txt endpoints) but targeting local disk instead
// of the Bitburner filesystem. Run with `npm run update:sphyxos` (add --force to skip the hash check).
const fs = require('fs');
const path = require('path');
const https = require('https');

const HASH_URL = 'https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOSHash.txt';
const MANIFEST_URL = 'https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOS.txt';
const versionFile = path.resolve(__dirname, 'sphyxos-version.txt');
const srcRoot = path.resolve(__dirname, '..', 'src');
const force = process.argv.includes('--force');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const remoteHash = (await get(HASH_URL)).trim();
  const localHash = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : null;

  if (!force && remoteHash === localHash) {
    console.log('SphyxOS is already up to date (hash unchanged).');
    return;
  }

  console.log(localHash === null ? 'No local version recorded, fetching manifest...' : 'Update available, fetching manifest...');
  const manifest = JSON.parse(await get(MANIFEST_URL));

  let added = 0, changed = 0, unchanged = 0;
  for (const item of manifest) {
    const content = JSON.parse(item.file);
    const target = path.resolve(srcRoot, item.filename);
    const existed = fs.existsSync(target);
    const previous = existed ? fs.readFileSync(target, 'utf8') : null;

    if (previous === content) {
      unchanged++;
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
    if (existed) {
      changed++;
      console.log(`  changed: ${item.filename}`);
    } else {
      added++;
      console.log(`  added:   ${item.filename}`);
    }
  }

  fs.writeFileSync(versionFile, remoteHash, 'utf8');
  console.log(`Done. ${added} added, ${changed} changed, ${unchanged} unchanged.`);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
