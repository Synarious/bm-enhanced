// Must match termList.json version
const EXTENSION_VERSION = "__VERSION__"; // Don't do any 0's as the minify will drop it.
const BM_ORG_ID = "__ORG_ID__";

const DATA_SOURCES = "__DATA_SOURCES__";

function versionsEqual(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return false;
    }
    return true;
}

const SELECTORS = {
    logContainer: '.ReactVirtualized__Grid__innerScrollContainer',
    logMessages: '.css-12yx96v',
    logPlayerNames: '.name a',
    logActivityNames: '.css-16howbp',
    logNoteFlags: '.css-1e64wdl',
    logServerNames: '.css-9svwgn span, .css-9svwgn a',
    logTimestamps: 'time[datetime]',
    playerPage: "#RCONPlayerPage",
    playerPageTitle: "#RCONPlayerPage h2",
    playerInfoTable: '#RCONPlayerPage table',
    orgEditPage: '#RCONOrgEditPage',
    orgRoleList: '#RCONOrgEditPage ul.list-unstyled > li',
    banButton: 'a[href="/rcon/bans"]',
    cornerButtonContainer: "#corner-button-container",
    actionsContainer: "#bmus-actions-container",
    copyInfoButton: "#copy-player-info-btn",
    cblInfoContainer: "#CBL-info-container",
};

(async () => {
    const DEBUG_LEVEL = 1; // 0=Off, 1=Basic, 2=Detailed, 3=Verbose
    const CACHE_TTL_MS = 300000; // 5 minutes
    const CACHE_PREFIX = 'bmus_cache_';

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
        },
        cachedColorMap: new Map()
    };

    function log(level, ...args) {
        if (level <= DEBUG_LEVEL) console.log('BMUS_LOG |', ...args);
    }

    async function fetchJSON(url, sourceName, options = {}) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) {
                console.warn(`⏳|BMUS: Rate limited fetching ${sourceName}`);
                return null;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${sourceName}`);
            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } catch (error) {
            console.error(`🚫|BMUS: Failed to fetch ${sourceName}.`, error);
            return null;
        }
    }

    async function fetchJSONCached(url, sourceName, options = {}) {
        const cacheKey = CACHE_PREFIX + sourceName.replace(/\s+/g, '_').toLowerCase();
        const now = Date.now();

        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const entry = JSON.parse(cached);
                if (now - entry.timestamp < CACHE_TTL_MS) {
                    log(2, `📦 Using cached ${sourceName} (${Math.round((now - entry.timestamp) / 1000)}s old)`);
                    return entry.data;
                }
            }
        } catch {
            void 0;
        }

        const data = await fetchJSON(url, sourceName, options);
        if (data) {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: now }));
            } catch {
                void 0;
            }
        }
        return data;
    }

    function evictStaleCache() {
        const now = Date.now();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(CACHE_PREFIX)) continue;
            try {
                const entry = JSON.parse(localStorage.getItem(key));
                if (now - entry.timestamp >= CACHE_TTL_MS) {
                    localStorage.removeItem(key);
                    i--;
                }
            } catch {
                localStorage.removeItem(key);
                i--;
            }
        }
    }

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
            .css-1e64wdl {
                color: rgb(255 255 255) !important;
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
            [data-testid="rcon-dashboard-server"] .css-1mrykm {
                overflow: hidden;
            }
            [data-testid="rcon-dashboard-server"] .server-handle {
                cursor: move;
                z-index: 10;
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

    const timestampFormatter = new Intl.DateTimeFormat(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short', hour12: true
    });

    function applyTimeStamps() {
        const elements = document.querySelectorAll(SELECTORS.logTimestamps);
        elements.forEach(el => {
            if (el.dataset.timestampApplied) return;
            const utcTime = el.getAttribute("datetime");
            if (!utcTime) return;
            const date = new Date(utcTime);
            if (isNaN(date.getTime())) return;
            el.title = timestampFormatter.format(date);
            el.dataset.timestampApplied = 'true';
        });
    }

    function styleLogMessages(logMessages, { sets, colors }) {
        const stylingRules = [
            { regex: /(?:\s|:|"|^)!admin/i, backgroundColor: '#9a000040', color: 'lime' },
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
                    break;
                }
            }
        });
    }

    function buildAdminColorMap(config) {
        const colorMap = new Map();
        const groups = [
            { list: state.adminLists.group1, color: config.colors.cStaffGroup1 },
            { list: state.adminLists.group2, color: config.colors.cStaffGroup2 },
            { list: state.adminLists.group3, color: config.colors.cStaffGroup3 },
        ];
        for (const { list, color } of groups) {
            if (!list || !color) continue;
            for (const admin of list) colorMap.set(admin.trim(), color);
        }
        return colorMap;
    }

    function styleAdminNames(adminNameElements) {
        if (state.cachedColorMap.size === 0) return;
        const prefixes = state.config.namePrefixes || [];

        adminNameElements.forEach(el => {
            if (el.dataset.colored) return;
            const name = el.textContent.trim();
            let color = state.cachedColorMap.get(name);

            if (!color) {
                for (const prefix of prefixes) {
                    if (name.startsWith(prefix)) {
                        color = state.cachedColorMap.get(name.substring(prefix.length).trim());
                        if (color) break;
                    }
                }
            }

            if (color) {
                el.style.color = color;
                el.dataset.colored = 'true';
            }
        });
    }

    function updateLogView() {
        if (!state.config) return;

        const logMessages = document.querySelectorAll(SELECTORS.logMessages);
        const adminNameElements = document.querySelectorAll(`${SELECTORS.logActivityNames}, ${SELECTORS.logPlayerNames}`);
        const serverNameElements = document.querySelectorAll(SELECTORS.logServerNames);
        const noteFlagElements = document.querySelectorAll(SELECTORS.logNoteFlags);

        styleLogMessages(logMessages, state.config);
        styleAdminNames(adminNameElements);

        const { serverName1, serverName2, colors } = state.config;
        serverNameElements.forEach(el => {
            if (el.dataset.colored) return;
            const text = el.textContent;
            if (text.includes(serverName1)) el.style.color = "green";
            else if (text.includes(serverName2)) el.style.color = "yellow";
            el.dataset.colored = 'true';
        });

        noteFlagElements.forEach(el => {
            if (el.style.color) return;
            const label = (
                el.getAttribute("title") ||
                el.getAttribute("aria-label") ||
                el.closest("[title]")?.getAttribute("title") ||
                el.closest("[aria-label]")?.getAttribute("aria-label") ||
                ""
            ).toLowerCase();
            if ((label.includes("note") || label.includes("flag")) && el.textContent.trim().length < 3) {
                el.style.color = colors.cNoteColorIcon;
            }
        });

        applyTimeStamps();
    }

    async function fetchCBLData(steamID, container) {
        const query = {
            query: `query Search($id: String!) { steamUser(id: $id) { riskRating, activeBans: bans(expired: false) { edges { node { id } } }, expiredBans: bans(expired: true) { edges { node { id } } } } }`,
            variables: { id: steamID }
        };
        const data = await fetchJSON("https://communitybanlist.com/graphql", "CBL GraphQL", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(query)
        });
        if (data?.data?.steamUser) {
            const { riskRating = 0, activeBans, expiredBans } = data.data.steamUser;
            const active = activeBans?.edges?.length ?? 0;
            const expired = expiredBans?.edges?.length ?? 0;
            const riskColor = riskRating > 5 ? "red" : riskRating > 0 ? "orange" : "white";
            container.innerHTML = `<span style="color: ${riskColor};">CBL: ${riskRating}/10</span> | <span>Act: ${active}</span> | <span>Exp: ${expired}</span>`;
        } else {
            container.innerHTML = '<span>CBL: Not Found</span>';
        }
    }

    function copyPlayerInfo() {
        const identifiersTable = document.querySelector(SELECTORS.playerInfoTable);
        if (!identifiersTable) {
            console.error("BMUS_ERROR: Could not find identifiers table.");
            return;
        }

        const rows = identifiersTable.querySelectorAll('tbody > tr');
        let allIdentifiers = [];

        rows.forEach(row => {
            const valueEl = row.querySelector('td[data-title="Identifier"] span');
            const typeCell = row.querySelector('td[data-title="Type"]');
            const timeEl = row.querySelector('td[data-title="Last Seen"] time');
            if (valueEl && typeCell && timeEl) {
                allIdentifiers.push({
                    value: valueEl.textContent.trim(),
                    type: typeCell.textContent.trim(),
                    timestamp: new Date(timeEl.getAttribute('datetime'))
                });
            }
        });

        allIdentifiers.sort((a, b) => b.timestamp - a.timestamp);

        const finalIdentifiers = new Map();
        for (const id of allIdentifiers) {
            if (!finalIdentifiers.has(id.type)) finalIdentifiers.set(id.type, id.value);
        }

        const infoToCopy = [];
        for (const type of ["Name", "Steam ID", "EOS ID"]) {
            if (finalIdentifiers.has(type)) infoToCopy.push(`${type}: ${finalIdentifiers.get(type)}`);
        }
        infoToCopy.push(`BM: <${window.location.href}>`);

        navigator.clipboard.writeText(infoToCopy.join('\n'))
            .then(() => log(1, "✅ Player info copied!"))
            .catch(err => console.error("🚫|BMUS: Clipboard copy failed", err));
    }

    async function setupPlayerPage() {
        if (state.page.isPlayerPage) return;

        const identifiersTable = document.querySelector(SELECTORS.playerInfoTable);
        if (!identifiersTable) return;
        log(1, 'Setting up player page.');

        let steamID = null;
        for (const row of identifiersTable.querySelectorAll('tbody > tr')) {
            const typeCell = row.querySelector('td[data-title="Type"]');
            const valueEl = row.querySelector('td[data-title="Identifier"] span');
            if (typeCell?.textContent.trim() === "Steam ID") {
                const id = valueEl?.textContent.trim();
                if (id?.startsWith("765")) { steamID = id; break; }
            }
        }

        state.page.isPlayerPage = true;

        let actionsContainer = document.querySelector(SELECTORS.actionsContainer);
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.id = SELECTORS.actionsContainer.substring(1);
            document.body.appendChild(actionsContainer);
        }

        if (!document.querySelector(SELECTORS.copyInfoButton)) {
            const btn = document.createElement('button');
            btn.id = SELECTORS.copyInfoButton.substring(1);
            btn.textContent = '📋 Copy';
            btn.title = 'Copy Player Info';
            btn.addEventListener('click', copyPlayerInfo);
            actionsContainer.appendChild(btn);
        }

        if (!document.querySelector(SELECTORS.cblInfoContainer)) {
            if (steamID) {
                const cblLink = document.createElement("a");
                cblLink.id = SELECTORS.cblInfoContainer.substring(1);
                cblLink.href = `https://communitybanlist.com/search/${steamID}`;
                cblLink.target = "_blank";
                cblLink.rel = "noopener noreferrer";
                cblLink.title = `View ${steamID} on Community Ban List`;
                cblLink.innerHTML = '<span>Loading CBL...</span>';
                actionsContainer.appendChild(cblLink);
                await fetchCBLData(steamID, cblLink);
            } else {
                const cblDiv = document.createElement("div");
                cblDiv.id = SELECTORS.cblInfoContainer.substring(1);
                cblDiv.innerHTML = '<span>CBL: SteamID not found</span>';
                actionsContainer.appendChild(cblDiv);
            }
        }
    }

    function updateOrgEditPage() {
        if (!state.page.isOrgEditPage) state.page.isOrgEditPage = true;
        document.querySelectorAll(SELECTORS.orgRoleList).forEach(li => {
            if (li.dataset.modified) return;
            const textNode = Array.from(li.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
            if (textNode) li.insertBefore(document.createTextNode(' ||| '), textNode.nextSibling);
            li.dataset.modified = 'true';
        });
    }

    function setupBanButton() {
        const banButton = document.querySelector(SELECTORS.banButton);
        if (!banButton || banButton.dataset.modified) return;

        const newBtn = banButton.cloneNode(true);
        newBtn.href = `/rcon/bans?filter%5Borganization%5D=${BM_ORG_ID}&filter%5Bexpired%5D=true`;
        newBtn.dataset.modified = 'true';
        banButton.parentNode.replaceChild(newBtn, banButton);
    }

    function isLogView() {
        return document.querySelector(SELECTORS.logContainer)
            || document.querySelector('[data-testid="activity"]');
    }

    let observerScheduled = false;

    function scheduleUpdate() {
        if (observerScheduled) return;
        observerScheduled = true;
        window.requestAnimationFrame(() => {
            observerScheduled = false;
            processDOMChanges();
        });
    }

    function processDOMChanges() {
        const onPlayerPage = document.querySelector(SELECTORS.playerPage);
        if (onPlayerPage) {
            setupPlayerPage();
        } else if (state.page.isPlayerPage) {
            document.querySelector(SELECTORS.actionsContainer)?.remove();
            state.page.isPlayerPage = false;
        }

        if (isLogView()) updateLogView();
        
        if (document.querySelector(SELECTORS.orgEditPage)) updateOrgEditPage();
        else state.page.isOrgEditPage = false;
        
        setupBanButton();
    }

    async function main() {
        log(1, `🚀 BMUS v${EXTENSION_VERSION}: Initializing...`);
        evictStaleCache();
        const [customConfig, adminList] = await Promise.all([
            fetchJSONCached(DATA_SOURCES.customConfig, "Custom Config"),
            fetchJSONCached(DATA_SOURCES.adminList, "Admin List")
        ]);

        if (!customConfig) {
            showVersionMismatchWarning(EXTENSION_VERSION, "Error", 
                `Could not load configuration from:\n${DATA_SOURCES.customConfig}`);
            return;
        }
        state.config = customConfig;

        const remoteVersion = state.config?.chrome_extension_version;
        if (!remoteVersion) {
            showVersionMismatchWarning(EXTENSION_VERSION, "Unavailable", 
                `Remote version missing from config.\nURL: ${DATA_SOURCES.customConfig}`);
        } else if (!versionsEqual(remoteVersion, EXTENSION_VERSION)) {
            showVersionMismatchWarning(EXTENSION_VERSION, remoteVersion,
                `Script version mismatched. Please update.\nConfig URL: ${DATA_SOURCES.customConfig}`);
        }

        if (adminList) {
            state.adminLists.group1 = new Set(adminList.group1);
            state.adminLists.group2 = new Set(adminList.group2);
            state.adminLists.group3 = new Set(adminList.group3);
        }
        state.cachedColorMap = buildAdminColorMap(state.config);

        injectGlobalCSS();
        new MutationObserver(scheduleUpdate).observe(document.body, { childList: true, subtree: true });
        processDOMChanges();
        log(1, "👀 Observer active.");
    }

    await main();
})();
