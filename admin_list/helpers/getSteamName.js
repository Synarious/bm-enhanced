const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const RATE_LIMIT_MS = 3000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const CACHE_FILE = path.join(__dirname, 'steam-name-cache.json');

function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        } catch (err) {
            console.log('Could not load cache, starting fresh\n');
        }
    }
    return {};
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

async function getSteamUsername(steamId, cache, apiKey, retryCount = 0) {
    if (cache[steamId]) return cache[steamId];

    return new Promise((resolve, _reject) => {
        const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`;
        console.log(`    → Making API request to Steam...`);

        https.get(url, (res) => {
            let data = '';
            console.log(`    → Response status: ${res.statusCode}`);
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log(`    → Received ${data.length} bytes of data`);
                try {
                    const response = JSON.parse(data);
                    if (response.response?.players?.length > 0) {
                        const playerName = response.response.players[0].personaname;
                        console.log(`    → Found player name: "${playerName}"`);
                        cache[steamId] = playerName;
                        resolve(playerName);
                    } else {
                        console.log(`    → No player data found, using Steam ID as fallback`);
                        cache[steamId] = steamId;
                        resolve(steamId);
                    }
                } catch (err) {
                    console.log(`    → Error parsing JSON: ${err.message}`);
                    if (retryCount < MAX_RETRIES) {
                        console.log(`    → Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
                        setTimeout(() => {
                            getSteamUsername(steamId, cache, apiKey, retryCount + 1).then(resolve);
                        }, RETRY_DELAY_MS);
                    } else {
                        cache[steamId] = steamId;
                        resolve(steamId);
                    }
                }
            });
        }).on('error', (err) => {
            console.log(`    → Network error: ${err.message}`);
            if (retryCount < MAX_RETRIES) {
                console.log(`    → Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
                setTimeout(() => {
                    getSteamUsername(steamId, cache, apiKey, retryCount + 1).then(resolve);
                }, RETRY_DELAY_MS);
            } else {
                cache[steamId] = steamId;
                resolve(steamId);
            }
        });
    });
}

async function resolveSteamNames(adminList) {
    const STEAM_API_KEY = process.env.STEAM_API_KEY;
    if (!STEAM_API_KEY) {
        throw new Error('STEAM_API_KEY not found in .env file');
    }

    if (!adminList) {
        const adminListPath = path.join(__dirname, '..', '..', 'src', 'config', 'adminList.json');
        try {
            adminList = JSON.parse(fs.readFileSync(adminListPath, 'utf8'));
        } catch (err) {
            throw new Error(`adminList.json not found or invalid. Run parseAdmin.js first.\n  ${err.message}`);
        }
    }

    const cache = loadCache();
    console.log(`Loaded ${Object.keys(cache).length} cached Steam names\n`);

    const uniqueSteamIds = [...new Set([
        ...adminList.group1, ...adminList.group2, ...adminList.group3
    ])];
    console.log(`Total unique Steam IDs to process: ${uniqueSteamIds.length}`);

    const uncachedIds = uniqueSteamIds.filter(id => !cache[id]);
    console.log(`Already cached: ${uniqueSteamIds.length - uncachedIds.length}`);
    console.log(`Need to fetch: ${uncachedIds.length}\n`);

    if (uncachedIds.length > 0) {
        console.log(`Estimated time: ${((uncachedIds.length * RATE_LIMIT_MS) / 1000 / 60).toFixed(1)} minutes\n`);
        console.log('Starting Steam API requests...\n');
    }

    for (let i = 0; i < uncachedIds.length; i++) {
        const steamId = uncachedIds[i];
        const progress = `[${i + 1}/${uncachedIds.length}]`;
        console.log(`\n${progress} Processing Steam ID: ${steamId}`);

        try {
            const username = await getSteamUsername(steamId, cache, STEAM_API_KEY);
            console.log(`${progress} ✓ Result: "${username}"`);
            if ((i + 1) % 10 === 0) {
                saveCache(cache);
                console.log(`\n  → Cache saved (${Object.keys(cache).length} entries total)\n`);
            }
            if (i < uncachedIds.length - 1) {
                console.log(`${progress} Waiting ${RATE_LIMIT_MS / 1000} seconds before next request...`);
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
            }
        } catch (err) {
            console.log(`${progress} ✗ Failed: ${err.message}`);
        }
    }

    saveCache(cache);
    console.log(`\n✓ All Steam names cached (${Object.keys(cache).length} total)\n`);

    const processedAdminList = {
        group1: adminList.group1.map(id => cache[id] || id).sort(),
        group2: adminList.group2.map(id => cache[id] || id).sort(),
        group3: adminList.group3.map(id => cache[id] || id).sort()
    };

    const outputPath = path.join(__dirname, 'processed_adminList.json');
    fs.writeFileSync(outputPath, JSON.stringify(processedAdminList, null, 2), 'utf8');
    console.log(`✓ Created processed_adminList.json at ${outputPath}`);

    const adminListOutput = path.join(__dirname, '..', '..', 'src', 'config', 'adminList.json');
    fs.mkdirSync(path.dirname(adminListOutput), { recursive: true });
    fs.writeFileSync(adminListOutput, JSON.stringify(processedAdminList, null, 2), 'utf8');
    console.log(`✓ Updated src/config/adminList.json with resolved Steam names`);
    console.log(`  - Group 1: ${processedAdminList.group1.length} users`);
    console.log(`  - Group 2: ${processedAdminList.group2.length} users`);
    console.log(`  - Group 3: ${processedAdminList.group3.length} users`);

    return processedAdminList;
}

module.exports = { resolveSteamNames };

if (require.main === module) {
    resolveSteamNames().catch(err => { console.error('Error:', err); process.exit(1); });
}
