const EXTENSION_VERSION = "3.00";
const bmORG_ID = 58064; // This is the organization ID for the BMUS organization. It is used to filter the ban list to only show bans from this organization.
const SOURCES = {
    adminList: "https://raw.githubusercontent.com/Synarious/bm-userscript/refs/heads/unnamed-ce/config/adminList.json",
    customConfig: "https://raw.githubusercontent.com/Synarious/bm-userscript/refs/heads/unnamed-ce/config/termList.json",
};

/*
 *
 * You shouldn't need to modify anything below this. Modify the json files in the config folder instead.
 *
 */


// DOM query selectors.
const SELECTORS = {
    logContainer: '.ReactVirtualized__Grid__innerScrollContainer, .css-b7r34x',
    logMessages: ".css-ym7lu8",
    logPlayerNames: ".css-1ewh5td",
    logActivityNames: ".css-fj458c",
    logNoteFlags: ".css-he5ni6",
    logServerNames: ".css-1ymmsk5",
    logTimestamps: ".css-z1s6qn",
    playerPage: "#RCONPlayerPage",
    playerPageTitle: "#RCONPlayerPage h2",
    playerInfoTable: '#RCONPlayerPage table.css-11gv980',
    orgEditPage: '#RCONOrgEditPage',
    orgRoleList: '#RCONOrgEditPage ul.list-unstyled > li',
    banButton: 'a[href="/rcon/bans"]',
    cornerButtonContainer: "#corner-button-container",
    actionsContainer: "#bmus-actions-container",
    copyInfoButton: "#copy-player-info-btn",
    cblInfoContainer: "#CBL-info-container",
};



(async () => {

    // --- DEBUGGING CONFIGURATION ---
    const DEBUG_LEVEL = 1; // 0=Off, 1=Basic, 2=Detailed, 3=Verbose

    /**
     * Custom logger that respects the DEBUG_LEVEL.
     * @param {number} level - The debug level of this message.
     * @param {...any} args - The content to log.
     */
    function log(level, ...args) {
        if (level <= DEBUG_LEVEL) {
            console.log('BMUS_LOG |', ...args);
        }
    }

    const state = {
        config: null,
        adminLists: { group1: new Set(), group2: new Set(), group3: new Set() },
        page: { isPlayerPage: false, isLogView: false, isOrgEditPage: false }
    };

    async function fetchJSON(url, sourceName, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status} for ${sourceName}`); }
            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch (error) {
            console.error(`🚫|BMUS: Failed to fetch ${sourceName}.`, error);
            return null;
        }
    }

    function injectGlobalCSS() {
        if (document.getElementById('bmus-global-styles')) return;
        const styles = `
            /* Wrapper for Copy and CBL buttons */
            #bmus-actions-container {
                position: absolute;
                top: 14.35em;
                left: 19em;
                z-index: 1000;
                display: flex;
                align-items: center;
            }
            /* Copy button styles */
            #copy-player-info-btn {
                padding: 4px;
                width: 75px;
                background: rgb(0, 123, 255);
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            }
            /* CBL container styles - now for an <a> tag */
            #CBL-info-container {
                margin-left: 10px;
                padding: 4px 8px;
                background: #000000bd;
                color: white; /* Default color */
                border-radius: 5px;
                font-size: 14px;
                font-weight: bold;
                white-space: nowrap;
                text-decoration: none; /* Remove underline */
                transition: filter 0.2s;
            }
            #CBL-info-container:hover {
                filter: brightness(1.2); /* Add a hover effect */
            }
            /* Other general styles */
            .main { width: 90% !important; margin-left: 4em; margin-right: 4em; } @media (max-width: 768px) { .main { width: inherit !important; } }
            .css-1nxi32t { width: 1px; } .css-1xkypod { position: unset !important; }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.id = 'bmus-global-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
        log(2, 'Global CSS injected.');
    }

    function showVersionMismatchWarning(localVer, remoteVer, message) {
        const warningBox = document.createElement("div");
        Object.assign(warningBox.style, { position: "fixed", top: "0", left: "0", width: "100%", height: "100%", backgroundColor: "rgba(19, 19, 19, 0.85)", color: "white", zIndex: "99999", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", fontSize: "2rem", fontWeight: "bold", textAlign: "center", backdropFilter: "blur(5px)" });
        warningBox.innerHTML = `<div>🚨 Battlemetrics - Chrome Extension Version Warning 🚨<br><br><div style="font-size: 1.5rem; max-width: 800px;">${message}</div><br><br>Local version: <span style="color: yellow">${localVer}</span> /// Remote version: <span style="color: cyan">${remoteVer}</span><br><br><button id="closeWarningBtn" style="padding: 10px 20px; font-size: 1rem; background: white; color: red; border: none; cursor: pointer; border-radius: 5px;">Ignore Warning & Close</button></div>`;
        document.body.appendChild(warningBox);
        document.getElementById("closeWarningBtn").addEventListener("click", () => warningBox.remove());
    }

    /**
     * THIS FUNCTION HAS BEEN CORRECTED
     */
    function updateLogView(scope = document) {
        if (!state.config) return;
        const { sets, colors, serverName1, serverName2, adminLists } = state.config;

        const allElements = scope.querySelectorAll(`${SELECTORS.logMessages}, ${SELECTORS.logActivityNames}, ${SELECTORS.logPlayerNames}`);
        const adminColorRules = [
            { list: adminLists.group1, color: colors.cStaffGroup1 },
            { list: adminLists.group2, color: colors.cStaffGroup2 },
            { list: adminLists.group3, color: colors.cStaffGroup3 }
        ];
        const messageColorRules = [
            { set: sets.joinedServer, color: colors.cJoined },
            { set: sets.leftServer, color: colors.cLeftServer },
            { set: sets.actionList, color: colors.cModAction },
            { set: sets.adminTerms, color: colors.cAdminAction },
            { set: sets.factionGroup1, color: colors.cFactionGroup1 },
            { set: sets.factionGroup2, color: colors.cFactionGroup2 },
            { set: sets.factionGroup3, color: colors.cFactionGroup3 },
            { set: sets.teamKilled, color: colors.cTeamKilled },
            { set: sets.trackedTriggers, color: colors.cTracked },
            { set: sets.grayedOut, color: colors.cGrayed },
        ];

        allElements.forEach(el => {
            if (el.dataset.bmusColored) return; // Single flag to prevent any re-processing

            let colorApplied = false;

            // Priority 1: Check for admin names if the element is a name element
            if (el.matches(`${SELECTORS.logActivityNames}, ${SELECTORS.logPlayerNames}`)) {
                for (const rule of adminColorRules) {
                    for (const admin of rule.list) {
                        if (el.textContent.includes(admin)) {
                            el.style.color = rule.color;
                            colorApplied = true;
                            break;
                        }
                    }
                    if (colorApplied) break;
                }
            }

            // Priority 2: Check for general messages if no admin color was applied
            if (!colorApplied && el.matches(SELECTORS.logMessages)) {
                for (const rule of messageColorRules) {
                    for (const phrase of rule.set) {
                        if (el.textContent.includes(phrase)) {
                            el.style.color = rule.color;
                            colorApplied = true;
                            break;
                        }
                    }
                    if (colorApplied) break;
                }
            }

            if (colorApplied) {
                el.dataset.bmusColored = 'true';
            }
        });

        // Handle other, non-conflicting elements separately
        scope.querySelectorAll(SELECTORS.logTimestamps).forEach(element => {
            if (element.title) return;
            const utcTime = element.getAttribute("datetime");
            if (utcTime) {
                const date = new Date(utcTime);
                if (!isNaN(date.getTime())) {
                    element.title = date.toLocaleString(undefined, { timeZoneName: 'short' });
                }
            }
        });

        scope.querySelectorAll(SELECTORS.logServerNames).forEach(element => {
            if (element.dataset.serverColored) return;
            if (element.textContent.includes(serverName1)) element.style.color = "green";
            else if (element.textContent.includes(serverName2)) element.style.color = "yellow";
            element.dataset.serverColored = 'true';
        });

        scope.querySelectorAll(SELECTORS.logNoteFlags).forEach(element => element.style.color = colors.cNoteColorIcon);
    }


    async function setupPlayerPage() {
        log(2, 'setupPlayerPage() called.');
        if (state.page.isPlayerPage) return;
        const identifiersTable = document.querySelector(SELECTORS.playerInfoTable);
        if (!identifiersTable) {
            log(2, 'setupPlayerPage: Identifiers table NOT found yet.');
            return;
        }
        log(1, 'Identifiers table found. Proceeding with player page setup.');
        let steamID = null;
        const rows = identifiersTable.querySelectorAll('tbody > tr');
        log(2, `Found ${rows.length} identifier rows. Searching for valid Steam ID...`);
        for (const row of rows) {
            const typeEl = row.querySelector('td[data-title="Type"] div.css-18s4qom');
            const valueEl = row.querySelector('td[data-title="Identifier"] span');
            if (typeEl && valueEl && typeEl.textContent.trim() === "Steam ID") {
                const potentialID = valueEl.textContent.trim();
                if (potentialID.startsWith("765")) {
                    steamID = potentialID;
                    log(2, `Valid Steam ID found for CBL: ${steamID}`);
                    break;
                }
            }
        }
        state.page.isPlayerPage = true;
        let actionsContainer = document.querySelector(SELECTORS.actionsContainer);
        if (!actionsContainer) {
            log(2, 'Creating actions container.');
            actionsContainer = document.createElement('div');
            actionsContainer.id = SELECTORS.actionsContainer.substring(1);
            document.body.appendChild(actionsContainer);
        }
        if (!document.querySelector(SELECTORS.copyInfoButton)) {
            log(2, 'Creating Copy button.');
            const btn = document.createElement('button');
            btn.id = SELECTORS.copyInfoButton.substring(1);
            btn.textContent = '📋 Copy';
            btn.title = 'Copy Player Info';
            btn.addEventListener('click', copyPlayerInfo);
            actionsContainer.appendChild(btn);
        }
        if (!document.querySelector(SELECTORS.cblInfoContainer)) {
            log(2, 'Creating CBL element...');
            if (steamID) {
                const cblLink = document.createElement("a");
                cblLink.id = SELECTORS.cblInfoContainer.substring(1);
                cblLink.href = `https://communitybanlist.com/search/${steamID}`;
                cblLink.target = "_blank";
                cblLink.rel = "noopener noreferrer";
                cblLink.title = `View ${steamID} on Community Ban List`;
                cblLink.innerHTML = '<span>Loading CBL...</span>';
                actionsContainer.appendChild(cblLink);
                log(2, 'Calling fetchCBLData().');
                await fetchCBLData(steamID, cblLink);
            } else {
                const cblDiv = document.createElement("div");
                cblDiv.id = SELECTORS.cblInfoContainer.substring(1);
                cblDiv.innerHTML = '<span>CBL: SteamID not found</span>';
                actionsContainer.appendChild(cblDiv);
                log(1, "Warning: No valid SteamID starting with '765' was found for CBL.");
            }
        }
    }

    function copyPlayerInfo() {
        log(2, '--- Starting copyPlayerInfo ---');
        const identifiersTable = document.querySelector(SELECTORS.playerInfoTable);
        if (!identifiersTable) {
            console.error("BMUS_ERROR: Could not find identifiers table for copy action.");
            return;
        }
        const rows = identifiersTable.querySelectorAll('tbody > tr');
        let allIdentifiers = [];
        rows.forEach((row, index) => {
            const valueEl = row.querySelector('td[data-title="Identifier"] span');
            const typeEl = row.querySelector('td[data-title="Type"] div.css-18s4qom');
            const timeEl = row.querySelector('td[data-title="Last Seen"] time');
            if (valueEl && typeEl && timeEl) {
                allIdentifiers.push({ value: valueEl.textContent.trim(), type: typeEl.textContent.trim(), timestamp: new Date(timeEl.getAttribute('datetime')) });
            } else {
                log(2, `Warning: Failed to parse row ${index}.`);
            }
        });
        log(3, 'Parsed all identifiers:', allIdentifiers);
        allIdentifiers.sort((a, b) => b.timestamp - a.timestamp);
        log(3, 'Sorted all identifiers by timestamp:', allIdentifiers);
        const finalIdentifiers = new Map();
        for (const id of allIdentifiers) {
            if (!finalIdentifiers.has(id.type)) {
                finalIdentifiers.set(id.type, id.value);
            }
        }
        log(2, 'Selected unique, most recent identifiers:', finalIdentifiers);
        const infoToCopy = [];
        const desiredOrder = ["Name", "BattlEye GUID", "Steam ID", "EOS ID"];
        for (const type of desiredOrder) {
            if (finalIdentifiers.has(type)) {
                infoToCopy.push(`${type}: ${finalIdentifiers.get(type)}`);
            }
        }
        infoToCopy.push(`BM: <${window.location.href}>`);
        const finalString = infoToCopy.join('\n');
        log(3, "--- Final string to be copied: ---\n" + finalString);
        navigator.clipboard.writeText(finalString)
            .then(() => log(1, "✅ Player info copied!"))
            .catch(err => console.error("🚫|BMUS: Clipboard copy failed", err));
    }

    async function fetchCBLData(steamID, container) {
        const graphqlEndpoint = "https://communitybanlist.com/graphql";
        const query = {
            query: `query Search($id: String!) { steamUser(id: $id) { riskRating, activeBans: bans(expired: false) { edges { node { id } } }, expiredBans: bans(expired: true) { edges { node { id } } } } }`,
            variables: { id: steamID }
        };
        const fetchOptions = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) };
        const data = await fetchJSON(graphqlEndpoint, "CBL GraphQL", fetchOptions);
        log(3, 'CBL Response Data:', data);
        if (data?.data?.steamUser) {
            const user = data.data.steamUser;
            const riskRating = user.riskRating ?? 0;
            const activeBans = user.activeBans?.edges?.length ?? 0;
            const expiredBans = user.expiredBans?.edges?.length ?? 0;
            const riskColor = riskRating > 5 ? "red" : riskRating > 0 ? "orange" : "white";
            container.innerHTML = `<span style="color: ${riskColor};">CBL: ${riskRating}/10</span> | <span>Act: ${activeBans}</span> | <span>Exp: ${expiredBans}</span>`;
        } else {
            container.innerHTML = '<span>CBL: Not Found</span>';
        }
    }

    function setupBanButton() {
        const banButton = document.querySelector(SELECTORS.banButton);
        if (banButton && !banButton.dataset.modified) {
            log(2, 'Found original ban button. Overriding its click behavior...');
            const newBanButton = banButton.cloneNode(true);
            newBanButton.href = "/rcon/bans?filter%5Borganization%5D=" + bmORG_ID;
            newBanButton.dataset.modified = 'true';
            banButton.parentNode.replaceChild(newBanButton, banButton);
            log(1, 'Ban button link successfully overridden.');
        }
    }

    function updateOrgEditPage() {
        if (!state.page.isOrgEditPage) {
            log(2, 'Setting up Organization Edit Page...');
            state.page.isOrgEditPage = true;
        }
        document.querySelectorAll(SELECTORS.orgRoleList).forEach(li => {
            if (li.dataset.modified) return;
            const firstTextNode = Array.from(li.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '');
            if (firstTextNode) {
                li.insertBefore(document.createTextNode(' ||| '), firstTextNode.nextSibling);
            }
            li.dataset.modified = 'true';
        });
    }

    function setupCornerButtons() {
        if (document.querySelector(SELECTORS.cornerButtonContainer)) return;
        const container = document.createElement("div");
        container.id = SELECTORS.cornerButtonContainer.substring(1);
        Object.assign(container.style, { position: "fixed", bottom: "10px", right: "10px", zIndex: "99999" });
        const versionButton = document.createElement("button");
        versionButton.textContent = `v${EXTENSION_VERSION}`;
        Object.assign(versionButton.style, { background: "black", color: "white", border: "1px solid white", borderRadius: "5px", padding: "5px", fontSize: "10px", cursor: "pointer" });
        container.appendChild(versionButton);
        document.body.appendChild(container);
        log(2, 'Corner buttons set up.');
    }

    function handleDOMChange(mutationsList) {
        log(3, 'DOM Change Detected, running checks...');
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches(SELECTORS.logContainer) || node.querySelector(SELECTORS.logMessages)) {
                            updateLogView(node);
                        }
                    }
                });
            }
        }
        const onPlayerPage = document.querySelector(SELECTORS.playerPage);
        if (onPlayerPage) {
            setupPlayerPage();
        } else {
            if (state.page.isPlayerPage) {
                log(1, 'Left player page, cleaning up.');
                document.querySelector(SELECTORS.actionsContainer)?.remove();
                state.page.isPlayerPage = false;
            }
        }
        if (document.querySelector(SELECTORS.orgEditPage)) {
            updateOrgEditPage();
        } else {
            if (state.page.isOrgEditPage) {
                state.page.isOrgEditPage = false;
            }
        }
        setupBanButton();
    }

    async function main() {
        log(1, `🚀 BMUS v${EXTENSION_VERSION}: Initializing...`);
        const [customConfig, adminList] = await Promise.all([fetchJSON(SOURCES.customConfig, "Custom Config"), fetchJSON(SOURCES.adminList, "Admin List")]);
        if (!customConfig) {
            showVersionMismatchWarning(EXTENSION_VERSION, "Error", `Could not load required configuration from:\n${SOURCES.customConfig}`);
            return;
        }
        // Attach the adminList to the state so updateLogView can access it
        state.config = customConfig;
        state.config.adminLists = adminList ? adminList : { group1: [], group2: [], group3: [] };

        const remoteVersion = state.config?.chrome_extension_version;
        if (!remoteVersion) {
            showVersionMismatchWarning(EXTENSION_VERSION, "Unavailable", `Remote version is missing from config.\nURL: ${SOURCES.customConfig}`);
        } else if (remoteVersion !== EXTENSION_VERSION) {
            showVersionMismatchWarning(EXTENSION_VERSION, remoteVersion, `Your script version is out of date. Please update.\nConfig URL: ${SOURCES.customConfig}`);
        } else {
            log(1, `Extension version (${EXTENSION_VERSION}) is up to date.`);
        }

        injectGlobalCSS();
        setupCornerButtons();
        updateLogView(document);
        handleDOMChange([]);
        const observer = new MutationObserver(handleDOMChange);
        observer.observe(document.body, { childList: true, subtree: true });
        log(1, "👀 Observer is active.");
    }

    main();
})();