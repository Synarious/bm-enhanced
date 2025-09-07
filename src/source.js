// ==================================================================================
// SECTION: GLOBAL CONFIGURATION & CONSTANTS
// ==================================================================================

// Must match termList.json to prevent version mismatch warnings.
const EXTENSION_VERSION = "3.01";
// BMUS Org ID, used for filtering the ban list.
const bmORG_ID = 58064;
const SOURCES = {
    adminList: "https://raw.githubusercontent.com/Synarious/bm-enhanced/refs/heads/unnamed/src/config/adminList.json",
    customConfig: "https://raw.githubusercontent.com/Synarious/bm-enhanced/refs/heads/unnamed/src/config/termList.json",
};

// DOM selectors.
const SELECTORS = {
    logContainer: '.ReactVirtualized__Grid__innerScrollContainer, .css-b7r34x',
    logMessages: ".css-ym7lu8",
    logPlayerNames: ".css-1ewh5td",
    logActivityNames: ".css-fj458c",
    logNoteFlags: ".css-he5ni6",
    logServerNames: ".css-1ymmsk5",
    logTimestamps: ".css-z1s6qn",
    logTimestampsLong: ".css-1jtoyp",
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


/*
 *
 * You shouldn't need to modify anything below this. Modify the json files in the config folder instead.
 *
 */

(async () => {

    // ==================================================================================
    // SECTION: SCRIPT STATE & DEBUGGING
    // ==================================================================================

    const DEBUG_LEVEL = 1; // 0=Off, 1=Basic, 2=Detailed, 3=Verbose

    const state = {
        config: null,
        adminLists: {
            group1: new Set(),
            group2: new Set(),
            group3: new Set()
        },
        page: {
            isPlayerPage: false,
            isLogView: false,
            isOrgEditPage: false
        }
    };

    function log(level, ...args) {
        if (level <= DEBUG_LEVEL) {
            console.log('BMUS_LOG |', ...args);
        }
    }

    // ==================================================================================
    // SECTION: CORE UTILITIES - Fetch remote JSON for src/config/*.json files.
    // ==================================================================================

    async function fetchJSON(url, sourceName, options = {}) {
        try {
            const response = await fetch(url, options);

            // Handle rate limiting
            if (response.status === 429) {
                console.warn(`⏳|BMUS: Rate limited when fetching ${sourceName}. Status: 429`);
                // Optionally implement retry logic here
                return null;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} for ${sourceName}`);
            }

            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch (error) {
            console.error(`🚫|BMUS: Failed to fetch ${sourceName}.`, error);
            return null;
        }
    }

    // ==================================================================================
    // SECTION: UI, STYLING, & WARNINGS - Injects global CSS, shows version mismatch warning.
    // ==================================================================================

    function injectGlobalCSS() {
        if (document.getElementById('bmus-global-styles')) return;
        const styles = `
            #bmus-actions-container {
                position: absolute;
                top: 14.35em;
                left: 19em;
                z-index: 1000;
                display: flex;
                align-items: center;
            }
            #copy-player-info-btn {
                padding: 4px;
                width: 75px;
                background: rgb(0,  123,  255);
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            }
            #CBL-info-container {
                margin-left: 10px;
                padding: 4px 8px;
                background: #000000bd;
                color: white;
                border-radius: 5px;
                font-size: 14px;
                font-weight: bold;
                white-space: nowrap;
                text-decoration: none;
                transition: filter 0.2s;
            }
            #CBL-info-container:hover {
                filter:  brightness(1.2);
            }
            .main {
                width: 90% !important;
                margin-left: 4em;
                margin-right: 4em;
            }
            @media (max-width: 768px) {
                .main {
                width: inherit !important;
            }
            }.css-1nxi32t {
                width: 1px;
            }
            .css-1xkypod {
                position: unset !important;
            }
            .css-mxzvlz {
                padding-left: 0.5em;
                width: 20%;
                display: inline-table;
            }
            .css-110bni0 {
                font-size: 14px;
            }
            @media (max-width: 1099px) and (min-width: 950px) {
                .css-mxzvlz {
                width: 33%;
                display: inline-table;
            }
            }@media (max-width: 949px) and (min-width: 601px) {
                .css-mxzvlz {
                width: 50%;
                display: inline-table;
            }
                
            }@media (max-width: 600px) {
                .css-mxzvlz {
                width: 100%;
                display: inline-table;
            }
        }`
        const styleSheet = document.createElement("style");
        styleSheet.id = 'bmus-global-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
        log(2, 'Global CSS injected.');
    }

    function showVersionMismatchWarning(localVer, remoteVer, message) {
        const warningBox = document.createElement("div");
        Object.assign(warningBox.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(19, 19, 19, 0.85)",
            color: "white",
            zIndex: "99999",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "2rem",
            fontWeight: "bold",
            textAlign: "center",
            backdropFilter: "blur(5px)"
        });
        warningBox.innerHTML =
            `<div>🚨 Battlemetrics - Chrome Extension Version Warning 🚨<br><br><div style="font-size: 1.5rem; max-width: 800px;">${message}</div><br><br>Local version: <span style="color: yellow">${localVer}</span> /// Remote version: <span style="color: cyan">${remoteVer}</span><br><br><button id="closeWarningBtn" style="padding: 10px 20px; font-size: 1rem; background: white; color: red; border: none; cursor: pointer; border-radius: 5px;">Ignore Warning & Close</button></div>`;
        document.body.appendChild(warningBox);
        document.getElementById("closeWarningBtn").addEventListener("click", () => warningBox.remove());
    }

    // ==================================================================================
    // SECTION: LOG VIEW LOGIC - applies seconds when hovering over timestamps, styles log
    // messages, colors admin names, colors server names, colors note flags
    // ==================================================================================

    function applyTimeStamps() {
        const timeStampElements = document.querySelectorAll(`${SELECTORS.logTimestamps}, ${SELECTORS.logTimestampsLong}`);

        const tooltipFormatOptions = {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', second: '2-digit',
            timeZoneName: 'short', hour12: true
        };

        timeStampElements.forEach(element => {
            // Skip elements that have already been processed
            if (element.dataset.timestampApplied) return;

            const utcTime = element.getAttribute("datetime");
            if (utcTime) {
                const date = new Date(utcTime);
                // Ensure the date is valid before trying to format it
                if (!isNaN(date.getTime())) {
                    // Using 'undefined' for locale uses the browser's default locale
                    element.title = date.toLocaleString(undefined, tooltipFormatOptions);
                    element.dataset.timestampApplied = 'true';
                }
            }
        });
    }

    /**
     * Applies color and background styles to log messages based on a set of rules.
     * @param {NodeListOf<Element>} logMessages - The message elements to style.
     * @param {object} config - The configuration object containing sets and colors.
     */
    function styleLogMessages(logMessages, { sets, colors }) {
        const stylingRules = [
            // Special rule for !admin calls (background color)
            {
                regex: /(?:\s|:|"|^)!admin/i, // Removed ^ anchor, added word boundary \b
                backgroundColor: '#9a000040',
                color: 'lime',
            },
            // Rules for text colors and special backgrounds
            { phrases: sets.grayedOut, color: colors.cGrayed },
            { phrases: sets.teamKilled, color: colors.cTeamKilled, backgroundColor: '#292135' },
            { phrases: sets.joinedServer, color: colors.cJoined },
            { phrases: sets.leftServer, color: colors.cLeftServer },
            { phrases: sets.actionList, color: colors.cModAction },
            { phrases: sets.adminTerms, color: colors.cAdminAction },
            { phrases: sets.coloredGroup1, color: colors.cColoredGroup1 },
            { phrases: sets.coloredGroup2, color: colors.cColoredGroup2 },
            { phrases: sets.coloredGroup3, color: colors.cColoredGroup3 },
            { phrases: sets.trackedTriggers, color: colors.cTracked }
        ];

        logMessages.forEach(element => {
            const logLine = element.parentElement;
            if (!logLine || logLine.dataset.styled) return;

            const textContent = element.textContent;

            for (const rule of stylingRules) {
                const isMatch = rule.regex
                    ? rule.regex.test(textContent.trim())
                    : rule.phrases.some(phrase => textContent.includes(phrase));

                if (isMatch) {
                    if (rule.color) element.style.color = rule.color;
                    if (rule.backgroundColor) logLine.style.backgroundColor = rule.backgroundColor;

                    logLine.dataset.styled = 'true';
                    break; // Rule applied, move to the next log element
                }
            }
        });
    }

    /**
     * Builds a Map for quick lookups of BASE admin names to their group color.
     * This map will contain only the admin names, without any prefixes.
     * @returns {Map<string, string>} A map of base admin names to colors.
     */
    function buildAdminBaseNameColorMap({ adminLists, config }) {
        const adminColorMap = new Map();
        const colorMapping = [
            { list: adminLists.group1, color: config.colors.cStaffGroup1 },
            { list: adminLists.group2, color: config.colors.cStaffGroup2 },
            { list: adminLists.group3, color: config.colors.cStaffGroup3 },
        ];

        for (const { list, color } of colorMapping) {
            if (!list || !color) continue;
            for (const admin of list) {
                adminColorMap.set(admin.trim(), color);
            }
        }
        return adminColorMap;
    }

    /**
     * Applies specific colors to admin names found in the logs. It handles names
     * with and without prefixes by stripping prefixes before map lookup.
     * @param {NodeListOf<Element>} adminNameElements - The name elements to style.
     * @param {object} state - The global state object.
     */
    function styleAdminNames(adminNameElements, state) {
        // 1. Build the map of base names to colors for fast lookups.
        const adminBaseNameColorMap = buildAdminBaseNameColorMap(state);
        if (adminBaseNameColorMap.size === 0) return;

        const prefixes = state.config.namePrefixes || [];

        adminNameElements.forEach(element => {
            if (element.dataset.colored) return;

            const nameFromLog = element.textContent.trim();
            let color;

            // 2. First, try a direct lookup (for names without prefixes).
            color = adminBaseNameColorMap.get(nameFromLog);

            // 3. If no direct match, iterate through prefixes and check again.
            //    This correctly handles prefixes and any spaces that follow.
            if (!color) {
                for (const prefix of prefixes) {
                    if (nameFromLog.startsWith(prefix)) {
                        // Strip the prefix and trim whitespace, then look up the base name.
                        const baseName = nameFromLog.substring(prefix.length).trim();
                        color = adminBaseNameColorMap.get(baseName);
                        if (color) {
                            break; // Found a match, no need to check other prefixes.
                        }
                    }
                }
            }

            // 4. If a color was found, apply it.
            if (color) {
                element.style.color = color;
                element.dataset.colored = 'true';
            }
        });
    }

    /**
     * The main function to coordinate all styling updates for the log view.
     * It queries the DOM once and delegates styling tasks to helper functions.
     */
    function updateLogView() {
        if (!state.config) return;

        // --- 1. Query the DOM once for all required elements ---
        const logMessages = document.querySelectorAll(SELECTORS.logMessages);
        const adminNameElements = document.querySelectorAll(`${SELECTORS.logActivityNames}, ${SELECTORS.logPlayerNames}`);
        const serverNameElements = document.querySelectorAll(SELECTORS.logServerNames);
        const noteFlagElements = document.querySelectorAll(SELECTORS.logNoteFlags);

        // --- 2. Delegate styling tasks to specialized functions ---
        styleLogMessages(logMessages, state.config);
        styleAdminNames(adminNameElements, state);

        // --- 3. Handle simpler, direct styling ---
        const { serverName1, serverName2, colors } = state.config;
        serverNameElements.forEach(element => {
            if (element.dataset.colored) return;
            const text = element.textContent;
            if (text.includes(serverName1)) element.style.color = "green";
            else if (text.includes(serverName2)) element.style.color = "yellow";
            element.dataset.colored = 'true';
        });

        noteFlagElements.forEach(element => {
            if (!element.style.color) { // Avoid re-applying style
                element.style.color = colors.cNoteColorIcon;
            }
        });

        // --- 4. Apply timestamp tooltips ---
        applyTimeStamps();
    }

    // ==================================================================================
    // SECTION: PLAYER PAGE LOGIC - For player pages within BattleMetrics.
    // ==================================================================================

    async function fetchCBLData(steamID, container) {
        const graphqlEndpoint = "https://communitybanlist.com/graphql";
        const query = {
            query: `query Search($id: String!) { steamUser(id: $id) { riskRating, activeBans: bans(expired: false) { edges { node { id } } }, expiredBans: bans(expired: true) { edges { node { id } } } } }`,
            variables: {
                id: steamID
            }
        };
        const fetchOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(query)
        };
        const data = await fetchJSON(graphqlEndpoint, "CBL GraphQL", fetchOptions);
        log(3, 'CBL Response Data:', data);
        if (data?.data?.steamUser) {
            const user = data.data.steamUser;
            const riskRating = user.riskRating ?? 0;
            const activeBans = user.activeBans?.edges?.length ?? 0;
            const expiredBans = user.expiredBans?.edges?.length ?? 0;
            const riskColor = riskRating > 5 ? "red" : riskRating > 0 ? "orange" : "white";
            container.innerHTML =
                `<span style="color: ${riskColor};">CBL: ${riskRating}/10</span> | <span>Act: ${activeBans}</span> | <span>Exp: ${expiredBans}</span>`;
        } else {
            container.innerHTML = '<span>CBL: Not Found</span>';
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
                allIdentifiers.push({
                    value: valueEl.textContent.trim(),
                    type: typeEl.textContent.trim(),
                    timestamp: new Date(timeEl.getAttribute('datetime'))
                });
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
        const desiredOrder = ["Name", "Steam ID", "EOS ID"];
        for (const type of desiredOrder) {
            if (finalIdentifiers.has(type)) {
                // This line formats the output as "Label: Value"
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

    // ==================================================================================
    // SECTION: ORGANIZATION EDIT PAGE LOGIC - Adds ||| to work within ./docs/ generator for your bm org member list.
    // ==================================================================================

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

    // ==================================================================================
    // SECTION: GLOBAL UI MODIFICATIONS - Changes ban button to filter by your org's global ban list by default.
    // ==================================================================================

    function setupBanButton() {
        const banButton = document.querySelector(SELECTORS.banButton);

        // Only proceed if the button exists and hasn't been modified by us yet.
        if (banButton && !banButton.dataset.modified) {
            log(2, 'Found original ban button. Overriding its click behavior...');

            const newBanButton = banButton.cloneNode(true);

            newBanButton.href = "/rcon/bans?filter%5Borganization%5D=" + bmORG_ID + "&filter%5Bexpired%5D=true";
            newBanButton.dataset.modified = 'true';

            banButton.parentNode.replaceChild(newBanButton, banButton);

            log(1, 'Ban button link updated.');
        }
    }

    // ==================================================================================
    // SECTION: DOM OBSERVER & Processing  - Watches for page changes and runs appropriate functions.
    // ==================================================================================

    function handleDOMChange() {
        log(3, 'DOM Change Detected, running checks...');
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
        if (document.querySelector(SELECTORS.logContainer)) {
            updateLogView();
        }
        if (document.querySelector(SELECTORS.orgEditPage)) {
            updateOrgEditPage();
        } else {
            state.page.isOrgEditPage = false;
        }
        setupBanButton();
    }

    async function main() {
        log(1, `🚀 BMUS v${EXTENSION_VERSION}: Initializing...`);
        const [customConfig, adminList] = await Promise.all([fetchJSON(SOURCES.customConfig, "Custom Config"), fetchJSON(SOURCES.adminList,
            "Admin List")]);
        if (!customConfig) {
            showVersionMismatchWarning(EXTENSION_VERSION, "Error", `Could not load required configuration from:\n${SOURCES.customConfig}`);
            return;
        }
        state.config = customConfig;
        const remoteVersion = state.config?.chrome_extension_version;
        if (!remoteVersion) {
            showVersionMismatchWarning(EXTENSION_VERSION, "Unavailable", `Remote version is missing from config.\nURL: ${SOURCES.customConfig}`);
        } else if (remoteVersion !== EXTENSION_VERSION) {
            showVersionMismatchWarning(EXTENSION_VERSION, remoteVersion,
                `Your script version is mismatched or outdated. Please update.\nConfig URL: ${SOURCES.customConfig}`);
        } else {
            log(1, `Extension version (${EXTENSION_VERSION}) is up to date.`);
        }
        if (adminList) {
            state.adminLists.group1 = new Set(adminList.group1);
            state.adminLists.group2 = new Set(adminList.group2);
            state.adminLists.group3 = new Set(adminList.group3);
            log(2, 'Admin lists loaded.');
        }
        injectGlobalCSS();
        const observer = new MutationObserver(handleDOMChange);
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        handleDOMChange();
        log(1, "👀 Observer is active.");
    }

    await main();

})();