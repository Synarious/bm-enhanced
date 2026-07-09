const { execSync } = require('child_process');
const https = require('https');

// 7-day buffer to mitigate supply chain attacks.
// Skips dependencies published within the last 7 days, giving the community
// time to identify and report malicious or broken releases before they
// are pulled into this project automatically.
const DAYS_BUFFER = 7;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Failed to parse ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const pkg = require('../package.json');
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  const toUpdate = [];

  console.log(`\n🔍 Checking ${Object.keys(allDeps).length} dependencies (${DAYS_BUFFER}-day buffer)...\n`);

  for (const [name, currentRange] of Object.entries(allDeps)) {
    try {
      const info = await fetchJSON(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
      const latestVer = info.version;
      const publishDate = new Date(info.time?.unpublished?.time || info.modified || Date.now());
      const daysOld = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);

      const installedVer = currentRange.replace(/^[\^~]/, '');

      if (installedVer === latestVer) {
        console.log(`  ✓ ${name} ${installedVer} is latest`);
      } else if (daysOld < DAYS_BUFFER) {
        console.log(`  ⏳ ${name} ${latestVer} published ${Math.floor(daysOld)}d ago — skipping (buffer: ${DAYS_BUFFER}d)`);
      } else {
        console.log(`  ⬆  ${name} ${installedVer} → ${latestVer} (${Math.floor(daysOld)}d old)`);
        toUpdate.push(`${name}@${latestVer}`);
      }
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  if (toUpdate.length === 0) {
    console.log('\n✅ All dependencies are up to date.\n');
    return;
  }

  console.log(`\n📦 Installing ${toUpdate.length} updated package(s)...\n`);
  execSync(`npm install ${toUpdate.join(' ')}`, { stdio: 'inherit' });
  console.log('\n✅ Update complete.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
