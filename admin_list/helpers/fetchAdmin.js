const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const https = require('https');

async function fetchOrgUsers() {
    const BM_TOKEN = process.env.BM_TOKEN;
    const ORG_ID = process.env.ORG_ID;

    if (!BM_TOKEN || !ORG_ID) {
        console.error('❌ Error: BM_TOKEN or ORG_ID not found in .env file');
        process.exit(1);
    }

    const url = `https://api.battlemetrics.com/organizations/${ORG_ID}?include=organizationUser`;

    console.log(`🔍 Fetching organization data for ORG_ID: ${ORG_ID}...`);

    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'Authorization': `Bearer ${BM_TOKEN}`,
                'Accept': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const outputFile = path.join(__dirname, 'admin-data.json');
                    fs.writeFileSync(outputFile, data, 'utf8');
                    console.log(`✅ Success! Data saved to ${outputFile}`);
                    console.log(`📊 Status: ${res.statusCode}`);

                    try {
                        const parsed = JSON.parse(data);
                        const userCount = parsed.included?.filter(i => i.type === 'organizationUser').length || 0;
                        console.log(`👥 Organization users found: ${userCount}`);
                        resolve(parsed);
                    } catch (e) {
                        console.error('❌ Error parsing API response:', e.message);
                        reject(new Error('Failed to parse Battlemetrics API response: ' + e.message));
                    }
                } else {
                    console.error(`❌ Error: Received status code ${res.statusCode}`);
                    fs.writeFileSync(path.join(__dirname, 'admin-data-error.txt'), `Status: ${res.statusCode}\n\n${data}`, 'utf8');
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            console.error('❌ Request failed:', err.message);
            reject(err);
        });
    });
}

module.exports = { fetchOrgUsers };

if (require.main === module) {
    fetchOrgUsers().catch(err => { console.error('❌', err.message); process.exit(1); });
}
