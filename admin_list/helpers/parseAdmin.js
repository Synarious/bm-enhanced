const fs = require('fs');
const path = require('path');

function loadRoles() {
    const customizationPath = path.join(__dirname, '..', '..', 'builds', 'customization.json');
    try {
        const customization = JSON.parse(fs.readFileSync(customizationPath, 'utf8'));
        const roles = customization.adminList?.roles;
        if (!roles) {
            throw new Error('Missing adminList.roles in customization.json');
        }
        return {
            adminLevel: roles.adminLevel || null,
            adminGame1: roles.adminGame1 || null,
            adminGame2: roles.adminGame2 || null,
            super_admin: roles.super_admin || null,
        };
    } catch (err) {
        throw new Error(`Failed to load role IDs from customization.json: ${err.message}`);
    }
}

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

    const ROLES = loadRoles();

    const activeRoles = Object.values(ROLES).filter(Boolean);
    if (activeRoles.length === 0) {
        console.log('⚠️  No role IDs configured in customization.json → adminList.roles. All users will be unmapped.\n');
    }

    const groups = { group1: [], group2: [], group3: [] };
    const debugInfo = { group1: [], group2: [], group3: [] };
    const unmapped = [];
    const allRoleIds = new Set();

    const organizationUsers = adminData.included.filter(item => item.type === 'organizationUser');

    console.log(`Processing ${organizationUsers.length} organization users...\n`);

    organizationUsers.forEach(user => {
        const nickname = user.attributes.nickname;
        const identifiers = user.attributes.identifiers || [];

        const userRoles = (user.relationships?.roles?.data || []).map(role => role.id);
        userRoles.forEach(id => allRoleIds.add(id));

        if (blacklist.includes(nickname)) return;

        const steamIDObj = identifiers.find(id => id.type === 'steamID');
        let steamID = steamIDObj ? steamIDObj.identifier : null;
        let isFallbackName = false;

        if (!steamID) {
            // Fallback: no SteamID linked in Battlemetrics — use BM nickname so the user still lands in a group
            steamID = nickname;
            isFallbackName = true;
        }

        const isAdminLevel = ROLES.adminLevel ? userRoles.includes(ROLES.adminLevel) : false;
        const isAdminGame1 = ROLES.adminGame1 ? userRoles.includes(ROLES.adminGame1) : false;
        const isAdminGame2 = ROLES.adminGame2 ? userRoles.includes(ROLES.adminGame2) : false;
        const isSuperAdmin = ROLES.super_admin ? userRoles.includes(ROLES.super_admin) : false;

        const roleInfo = {
            nickname, steamID, isFallbackName,
            roles: { adminLevel: isAdminLevel, adminGame1: isAdminGame1, adminGame2: isAdminGame2, super_admin: isSuperAdmin },
            allRoleIds: userRoles
        };

        if (isSuperAdmin || (isAdminGame2 && isAdminGame1)) {
            groups.group3.push(steamID);
            debugInfo.group3.push(roleInfo);
        } else if (isAdminGame2) {
            groups.group2.push(steamID);
            debugInfo.group2.push(roleInfo);
        } else if (isAdminGame1 || isAdminLevel) {
            groups.group1.push(steamID);
            debugInfo.group1.push(roleInfo);
        } else {
            unmapped.push(roleInfo);
        }
    });

    groups.group1.sort(); groups.group2.sort(); groups.group3.sort();

    const outputPath = path.join(__dirname, '..', '..', 'src', 'config', 'adminList.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(groups, null, 2), 'utf8');
    console.log(`✓ Created adminList.json at ${outputPath}`);
    console.log(`  - Group 1: ${groups.group1.length} users (AdminGame1 OR AdminLevel)`);
    console.log(`  - Group 2: ${groups.group2.length} users (AdminGame2, no AdminGame1)`);
    console.log(`  - Group 3: ${groups.group3.length} users (AdminGame2 + AdminGame1 OR Super Admin)`);

    if (unmapped.length > 0) {
        console.log(`\n⚠️  ${unmapped.length} users with SteamID were NOT mapped to any group:`);
        unmapped.forEach(u => {
            console.log(`    ${u.nickname} — role IDs: [${u.allRoleIds.join(', ')}]`);
        });
        console.log('');
    }

    const sortedRoleIds = [...allRoleIds].sort();
    console.log(`📋 All role IDs found in organization (${sortedRoleIds.length} total):`);
    sortedRoleIds.forEach(id => console.log(`    ${id}`));
    console.log('');

    const debugPath = path.join(__dirname, 'admin-parse-debug.txt');
    let debugText = '=== ADMIN PARSER DEBUG INFORMATION ===\n\n';

    [1, 2, 3].forEach(groupNum => {
        const info = debugInfo[`group${groupNum}`];
        const titles = { 1: 'AdminGame1 OR AdminLevel', 2: 'AdminGame2 (no AdminGame1)', 3: 'AdminGame2 + AdminGame1 OR Super Admin' };
        debugText += `GROUP ${groupNum} (${info.length} users) - ${titles[groupNum]}:\n`;
        debugText += '='.repeat(80) + '\n';
        info.forEach(user => {
            debugText += `${user.nickname}\n`;
            debugText += `  SteamID: ${user.steamID}${user.isFallbackName ? ' (nickname fallback — no SteamID linked)' : ''}\n`;
            debugText += `  Role IDs: [${user.allRoleIds.join(', ')}]\n\n`;
        });
        debugText += '\n';
    });

    if (unmapped.length > 0) {
        debugText += `UNMAPPED USERS (${unmapped.length} users with SteamID, no matching role):\n`;
        debugText += '='.repeat(80) + '\n';
        debugText += 'These users have SteamIDs but none of their role IDs match what is set\n';
        debugText += 'in customization.json → adminList.roles. Update the role IDs there.\n\n';
        unmapped.forEach(user => {
            debugText += `${user.nickname}\n`;
            debugText += `  SteamID: ${user.steamID}\n`;
            debugText += `  Role IDs: [${user.allRoleIds.join(', ')}]\n\n`;
        });
    }

    debugText += '='.repeat(80) + '\nALL ROLE IDs FOUND IN ORGANIZATION:\n';
    debugText += `(Copy these into customization.json → adminList.roles)\n\n`;
    sortedRoleIds.forEach(id => { debugText += `  ${id}\n`; });
    debugText += '\n';

    debugText += '='.repeat(80) + '\nSUMMARY:\n';
    debugText += `  Total users processed: ${organizationUsers.length}\n`;
    debugText += `  Users mapped (SteamID or nickname fallback): ${groups.group1.length + groups.group2.length + groups.group3.length}\n`;
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
