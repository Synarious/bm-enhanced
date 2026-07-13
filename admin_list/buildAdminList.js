const { fetchOrgUsers } = require('./helpers/fetchAdmin');
const { parseAdminData } = require('./helpers/parseAdmin');
const { resolveSteamNames } = require('./helpers/getSteamName');

async function buildAdminList() {
    console.log('=== BUILD ADMIN LIST ===\n');

    console.log('Step 1/3: Fetching organization data from Battlemetrics...\n');
    const adminData = await fetchOrgUsers();
    if (!adminData) throw new Error('No data returned from Battlemetrics API');

    console.log('\nStep 2/3: Parsing and grouping admin users...\n');
    const groups = parseAdminData(adminData);

    console.log('\nStep 3/3: Resolving Steam IDs to profile names...\n');
    await resolveSteamNames(groups);

    console.log('\n=== ALL DONE ===');
}

module.exports = { buildAdminList };

if (require.main === module) {
    buildAdminList().catch(err => {
        console.error('\n❌ BUILD FAILED:', err.message);
        process.exit(1);
    });
}
