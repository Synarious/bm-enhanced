const fs = require('fs');
const path = require('path');

const ROLES = {
    REFORGER_ADMIN: '37337',
    SQUAD_ADMIN: '37220',
    SQUAD_MODERATOR: '37219',
    DIRECTOR: '24942'
};

function parseAdminData(adminData) {
    const blacklistConfigPath = path.join(__dirname, 'blacklistConfig.json');
    let blacklist = [];
    try {
        const blacklistConfig = JSON.parse(fs.readFileSync(blacklistConfigPath, 'utf8'));
        blacklist = blacklistConfig.blacklist || [];
    } catch (err) {
        console.log('No blacklist config found, proceeding without blacklist');
    }

    if (!adminData) {
        const adminDataPath = path.join(__dirname, 'admin-data.json');
        try {
            adminData = JSON.parse(fs.readFileSync(adminDataPath, 'utf8'));
        } catch (err) {
            throw new Error(`admin-data.json not found or invalid. Run fetchAdmin.js first.\n  ${err.message}`);
        }
    }

    const groups = { group1: [], group2: [], group3: [] };
    const debugInfo = { group1: [], group2: [], group3: [] };

    const organizationUsers = adminData.included.filter(item => item.type === 'organizationUser');

    console.log(`Processing ${organizationUsers.length} organization users...\n`);

    organizationUsers.forEach(user => {
        const nickname = user.attributes.nickname;
        const identifiers = user.attributes.identifiers || [];

        if (blacklist.includes(nickname)) return;

        const steamIDObj = identifiers.find(id => id.type === 'steamID');
        const steamID = steamIDObj ? steamIDObj.identifier : null;

        if (!steamID) return;

        const roles = user.relationships.roles.data.map(role => role.id);
        const hasReforgerAdmin = roles.includes(ROLES.REFORGER_ADMIN);
        const hasSquadAdmin = roles.includes(ROLES.SQUAD_ADMIN);
        const hasSquadModerator = roles.includes(ROLES.SQUAD_MODERATOR);
        const hasDirector = roles.includes(ROLES.DIRECTOR);

        const roleInfo = {
            nickname, steamID,
            roles: { reforgerAdmin: hasReforgerAdmin, squadAdmin: hasSquadAdmin, squadModerator: hasSquadModerator, director: hasDirector }
        };

        if (hasDirector || (hasReforgerAdmin && hasSquadAdmin) || (hasReforgerAdmin && hasSquadModerator)) {
            groups.group3.push(steamID);
            debugInfo.group3.push(roleInfo);
        } else if (hasReforgerAdmin) {
            groups.group2.push(steamID);
            debugInfo.group2.push(roleInfo);
        } else if (hasSquadAdmin || hasSquadModerator) {
            groups.group1.push(steamID);
            debugInfo.group1.push(roleInfo);
        }
    });

    groups.group1.sort(); groups.group2.sort(); groups.group3.sort();

    const outputPath = path.join(__dirname, '..', '..', 'src', 'config', 'adminList.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(groups, null, 2), 'utf8');
    console.log(`✓ Created adminList.json at ${outputPath}`);
    console.log(`  - Group 1: ${groups.group1.length} users (Squad Admin OR Squad Moderator)`);
    console.log(`  - Group 2: ${groups.group2.length} users (Reforger Admin)`);
    console.log(`  - Group 3: ${groups.group3.length} users (Reforger Admin + Squad roles OR Director)`);

    const debugPath = path.join(__dirname, 'admin-parse-debug.txt');
    let debugText = '=== ADMIN PARSER DEBUG INFORMATION ===\n\n';
    const roleLabels = { squadAdmin: 'Squad Admin', squadModerator: 'Squad Moderator', reforgerAdmin: 'Reforger Admin', director: 'Director' };

    [1, 2, 3].forEach(groupNum => {
        const info = debugInfo[`group${groupNum}`];
        const titles = { 1: 'Squad Admin OR Squad Moderator', 2: 'Reforger Admin', 3: 'Reforger Admin + Squad roles OR Director' };
        debugText += `GROUP ${groupNum} (${info.length} users) - ${titles[groupNum]}:\n`;
        debugText += '='.repeat(80) + '\n';
        info.forEach(user => {
            debugText += `${user.nickname}\n`;
            debugText += `  SteamID: ${user.steamID}\n`;
            debugText += `  Roles: `;
            const rl = [];
            if (user.roles.squadAdmin) rl.push('Squad Admin');
            if (user.roles.squadModerator) rl.push('Squad Moderator');
            if (user.roles.reforgerAdmin) rl.push('Reforger Admin');
            if (user.roles.director) rl.push('Director');
            debugText += rl.join(', ') + '\n\n';
        });
        debugText += '\n';
    });

    debugText += '='.repeat(80) + '\nSUMMARY:\n';
    debugText += `  Total users processed: ${organizationUsers.length}\n`;
    debugText += `  Users with Steam ID: ${groups.group1.length + groups.group2.length + groups.group3.length}\n`;
    debugText += `  Group 1: ${groups.group1.length}\n  Group 2: ${groups.group2.length}\n  Group 3: ${groups.group3.length}\n`;

    fs.writeFileSync(debugPath, debugText, 'utf8');
    console.log(`\n✓ Created debug file at ${debugPath}`);
    console.log('\nDone!');

    return groups;
}

module.exports = { parseAdminData };

if (require.main === module) {
    parseAdminData();
}
