// Pulls the latest SphyxOS release manifest and writes it into src/, mirroring what SphyxOS's own
// in-game updater does (same SphyxOSHash.txt / SphyxOS.txt endpoints, or the SphyxOSBetaHash.txt /
// SphyxOSBeta.txt endpoints its in-game "Beta" toggle uses) but targeting local disk instead of the
// Bitburner filesystem. Run with `npm run update:sphyxos` (add --force to skip the hash check, --beta
// to track the beta channel instead of stable).
const fs = require('fs');
const path = require('path');
const https = require('https');

const beta = process.argv.includes('--beta');
const HASH_URL = `https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOS${beta ? 'Beta' : ''}Hash.txt`;
const MANIFEST_URL = `https://raw.githubusercontent.com/Sphyxis/SphyxOS/main/SphyxOS${beta ? 'Beta' : ''}.txt`;
const versionFile = path.resolve(__dirname, beta ? 'sphyxos-version-beta.txt' : 'sphyxos-version.txt');
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
  const channel = beta ? 'beta' : 'stable';
  const remoteHash = (await get(HASH_URL)).trim();
  const localHash = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : null;

  if (!force && remoteHash === localHash) {
    console.log(`SphyxOS (${channel}) is already up to date (hash unchanged).`);
    return;
  }

  console.log(localHash === null ? `No local ${channel} version recorded, fetching manifest...` : `Update available on ${channel}, fetching manifest...`);
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
