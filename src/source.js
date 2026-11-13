const EXTENSION_VERSION = "__VERSION__";
const BM_ORG_ID = "__ORG_ID__";

const DATA_SOURCES = "__DATA_SOURCES__";
const DEFAULT_TERMS = "__DEFAULT_TERMS__";
const DEFAULT_ADMINS = "__DEFAULT_ADMINS__";
const ADMIN_GROUPS = ['group1', 'group2', 'group3'];
const REQUEST_TIMEOUT_MS = 10000;
const STYLE_ID = 'bmus-global-styles';
const CBL_ENDPOINT = 'https://communitybanlist.com/graphql';
const BAN_PATH = '/rcon/bans';
const BAN_LINK = 'a[href^="/rcon/bans"]';
const BAN_TARGET = `${BAN_PATH}?filter%5Borganization%5D=${BM_ORG_ID}&filter%5Bexpired%5D=true`;

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
    logContainer: '.ReactVirtualized__Grid__innerScrollContainer, [data-testid="activity"]:not(:has(.ReactVirtualized__Grid__innerScrollContainer))',
    logMessages: '.css-12yx96v, :scope > span[role="button"]:has(> time[datetime]) + div',
    logPlayerNames: '.name > a, .name a[href^="/rcon/players/"]',
    logActivityNames: 'a[href^="/rcon/players/"], .css-16howbp',
    logNoteFlags: '.glyphicon-comment, .css-1e64wdl',
    serverNameDisplays: '.server-name a, td.byOn span[title], #RCONServerLayout h1, .server-link a[href^="/rcon/servers/"]',
    logTimestamps: 'time[datetime]',
    playerPage: "#RCONPlayerPage",
    playerInfoTable: 'table:has(td[data-title="Identifier"])',
    identifierRows: 'tbody > tr',
    identifierType: 'td[data-title="Type"]',
    identifierValue: 'td[data-title="Identifier"] span',
    identifierLastSeen: 'td[data-title="Last Seen"] time',
    squadDetails: '.player-detail:not(.hidden)',
    squadCommand: '.commands:not(.th) button[aria-label="Commands"], .commands:not(.th) > button, .commands:not(.th) > div > button:first-child',
    orgEditPage: '#RCONOrgEditPage',
    orgRoleList: 'ul.list-unstyled > li',
    rconNav: '#RCONLayout nav',
    actionsContainer: "#bmus-actions-container",
    copyInfoButton: "#copy-player-info-btn",
    cblInfoContainer: "#CBL-info-container",
};

(() => {
    const DEBUG_LEVEL = 1; // 0=Off, 1=Basic, 2=Detailed, 3=Verbose
    const CACHE_TTL_MS = 300000; // 5 minutes
    const CACHE_PREFIX = 'bmus_cache_';

    const state = {
        config: null,
        adminLists: DEFAULT_ADMINS,
        adminColors: new Map(),
        serverColors: [],
        logRules: []
    };

    function log(level, ...args) {
        if (level <= DEBUG_LEVEL) console.log('BMUS_LOG |', ...args);
    }

    async function fetchJSON(operation, url, sourceName, { steamID, ...options } = {}) {
        try {
            if (typeof GM_xmlhttpRequest === 'function') {
                const result = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        url,
                        method: options.method || 'GET',
                        headers: options.headers,
                        data: options.body,
                        anonymous: true,
                        timeout: REQUEST_TIMEOUT_MS,
                        onload: resolve,
                        onerror: reject,
                        ontimeout: reject,
                        onabort: reject
                    });
                });
                if (result.status < 200 || result.status >= 300) throw new Error(`HTTP ${result.status}`);
                return JSON.parse(result.responseText);
            }
            if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
                const reply = await chrome.runtime.sendMessage({ type: 'bmus:fetch', operation, steamID });
                if (reply?.error) throw new Error(reply.error);
                return reply?.data ?? null;
            }
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

    function readCache(url, validate) {
        try {
            const entry = JSON.parse(localStorage.getItem(CACHE_PREFIX + url));
            return entry && validate(entry.data) ? entry : null;
        } catch {
            return null;
        }
    }

    async function refreshConfig(operation, url, sourceName, validate) {
        const data = await fetchJSON(operation, url, sourceName, { signal: window.AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!validate(data)) return null;
        try {
            localStorage.setItem(CACHE_PREFIX + url, JSON.stringify({ data, timestamp: Date.now() }));
        } catch {
            void 0;
        }
        return data;
    }

    const isStringList = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim());
    const isAdminConfig = value => ADMIN_GROUPS.every(group => isStringList(value?.[group]));
    const isTermConfig = value => value?.sets && value.colors && typeof value.colors === 'object' && !Array.isArray(value.colors)
        && Object.keys(DEFAULT_TERMS.sets).every(group => isStringList(value.sets[group]))
        && Object.values(value.colors).every(color => typeof color === 'string')
        && ['serverName1', 'serverName2'].every(key => value[key] == null || typeof value[key] === 'string')
        && (value.namePrefixes == null || isStringList(value.namePrefixes))
        && (value.phraseHighlights == null || isStringList(value.phraseHighlights));

    function injectGlobalCSS() {
        const styles = `
            /* Player profile actions */
            #bmus-actions-container {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 0.5rem;
                margin-block: 0.5rem;
            }
            #copy-player-info-btn {
                padding: 4px;
                width: 75px;
                background: #005ec4;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            }
            #CBL-info-container {
                padding: 4px 8px;
                background: #000000bd;
                color: white;
                border-radius: 5px;
                font-size: 14px;
                font-weight: bold;
                text-decoration: none;
                transition: filter 0.2s;
            }
            #CBL-info-container:hover {
                filter: brightness(1.2);
            }

            /* RCON dashboard drag handles */
            .css-1e8vu3u .server-handle {
                cursor: move;
                z-index: 10 !important;
            }

            /* Desktop RCON layout */
            @media (min-width: 769px) {
                .main,
                #RCONContainer:has(> #RCONServerLayout) {
                    width: 90% !important;
                    margin-inline: auto;
                }
            }

            [data-bmus-text-color] {
                color: var(--bmus-text-color) !important;
            }
            [data-bmus-row-background] {
                background-color: var(--bmus-row-background) !important;
            }
            [data-bmus-squad-command] {
                background-color: #b98904 !important;
                color: #020202 !important;
            }
            ::highlight(bmus-keyword) {
                background-color: #ffe181;
                color: #211700;
            }

            /* Overrides for BattleMetrics layouts that lack stable selectors */
            .css-1nxi32t {
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
                }
            }
            @media (max-width: 949px) and (min-width: 601px) {
                .css-mxzvlz {
                    width: 50%;
                }
            }
            @media (max-width: 600px) {
                .css-mxzvlz {
                    width: 100%;
                }
            }
        `;
        const styleSheet = document.createElement("style");
        styleSheet.id = STYLE_ID;
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
        log(2, 'Global CSS injected.');
    }

    function showVersionMismatchWarning(localVer, remoteVer, message) {
        const warningBox = document.createElement("div");
        warningBox.id = 'bmus-version-warning';
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
        const heading = document.createElement('h2');
        heading.textContent = 'BattleMetrics Extension Version Warning';
        const details = document.createElement('p');
        details.style.whiteSpace = 'pre-line';
        details.style.overflowWrap = 'anywhere';
        details.textContent = message;
        const versions = document.createElement('p');
        versions.textContent = `Local version: ${localVer} / Remote version: ${remoteVer}`;
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Ignore Warning & Close';
        close.addEventListener('click', () => warningBox.remove());
        warningBox.append(heading, details, versions, close);
        document.body.appendChild(warningBox);
    }

    const timestampFormatter = new Intl.DateTimeFormat(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short', hour12: true
    });

    function applyTimestamp(el) {
        const utcTime = el.dateTime;
        if (!utcTime || utcTime.startsWith('P') || el.dataset.bmusTimestamp === utcTime) return;
        const date = new Date(utcTime);
        if (isNaN(date.getTime())) return;
        el.title = timestampFormatter.format(date);
        el.dataset.bmusTimestamp = utcTime;
    }

    function applyHighlight(element, property, color) {
        const attribute = `data-bmus-${property}`;
        const variable = `--bmus-${property}`;
        if (color) {
            if (element.style.getPropertyValue(variable) !== color) {
                element.style.setProperty(variable, color);
            }
            if (!element.hasAttribute(attribute)) element.setAttribute(attribute, '');
        } else if (element.hasAttribute(attribute)) {
            element.style.removeProperty(variable);
            element.removeAttribute(attribute);
        }
    }

    function buildServerColors({ serverName1, serverName2, colors }) {
        // Longer names win when one server name contains another.
        return [
            { name: serverName1, color: colors.cServerName1 || '#39FF14' },
            { name: serverName2, color: colors.cServerName2 || '#FFFF00' }
        ].filter(entry => entry.name).sort((a, b) => b.name.length - a.name.length);
    }

    function buildLogRules({ sets, colors }) {
        return [
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
    }

    const styledLogText = new WeakMap();

    function styleLogMessage(element) {
        const logLine = element.parentElement;
        const textContent = element.textContent;
        const cached = styledLogText.get(element);
        if (cached?.text === textContent && cached.rules === state.logRules && cached.row === logLine) return;
        styledLogText.set(element, { text: textContent, rules: state.logRules, row: logLine });
        const match = state.logRules.find(rule => rule.regex
            ? rule.regex.test(textContent.trim())
            : rule.phrases?.some(phrase => textContent.includes(phrase)));
        const phraseMatch = !wordHighlights && state.config.phraseHighlights?.some(phrase => textContent.includes(phrase));
        applyHighlight(element, 'text-color', match?.color || (phraseMatch ? '#ffe181' : null));
        applyHighlight(logLine, 'row-background', match?.backgroundColor);
    }

    function buildAdminColorMap({ colors }, admins) {
        const colorMap = new Map();
        for (const [index, group] of ADMIN_GROUPS.entries()) {
            const color = colors[`cStaffGroup${index + 1}`];
            if (!color) continue;
            for (const admin of admins[group]) colorMap.set(admin.trim(), color);
        }
        return colorMap;
    }

    function adminColorFor(name) {
        const directColor = state.adminColors.get(name);
        if (directColor) return directColor;
        for (const prefix of state.config.namePrefixes || []) {
            if (name.startsWith(prefix)) {
                const color = state.adminColors.get(name.substring(prefix.length).trim());
                if (color) return color;
            }
        }
        return null;
    }

    function stylePlayerRows(root) {
        root.querySelectorAll(SELECTORS.logPlayerNames).forEach(el => {
            const nameContainer = el.closest('.name');
            const isLeader = Array.from(nameContainer.querySelectorAll(SELECTORS.squadDetails))
                .some(detail => detail.textContent.trim() === 'Squad Leader'
                    || detail.querySelector('.small.text-muted')?.textContent.trim() === 'Squad Leader');
            const row = nameContainer.closest('[role="row"]');
            const button = row?.querySelector(SELECTORS.squadCommand);
            button?.toggleAttribute('data-bmus-squad-command', isLeader);
            applyHighlight(el, 'text-color', adminColorFor(el.textContent.trim()) || (isLeader ? '#ffd900' : null));
        });
    }

    function styleServerName(el) {
        const name = el.textContent.replace(/\s+/g, ' ');
        const match = state.serverColors.find(server => name.includes(server.name));
        applyHighlight(el, 'text-color', match?.color);
    }

    const phraseRanges = new Map();
    const wordHighlights = window.CSS?.highlights && window.Highlight && window.StaticRange ? new window.Highlight() : null;

    function clearPhraseRanges(row) {
        for (const range of phraseRanges.get(row) || []) wordHighlights.delete(range);
        phraseRanges.delete(row);
    }

    function highlightPhrases(row, messages) {
        clearPhraseRanges(row);
        const phrases = state.config.phraseHighlights;
        if (!wordHighlights || !phrases?.length) return;
        const ranges = [];
        for (const message of messages) {
            const text = message.textContent;
            const matches = [];
            for (const phrase of phrases) {
                for (let start = text.indexOf(phrase); start !== -1; start = text.indexOf(phrase, start + phrase.length)) {
                    matches.push({ start, end: start + phrase.length });
                }
            }
            if (!matches.length) continue;
            const walker = document.createTreeWalker(message, window.NodeFilter.SHOW_TEXT);
            const parts = [];
            let offset = 0;
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                parts.push({ node, start: offset, end: offset + node.length });
                offset += node.length;
            }
            for (const { start, end } of matches) {
                const first = parts.find(part => part.end > start);
                const last = parts.find(part => part.end >= end);
                const range = new window.StaticRange({
                    startContainer: first.node, startOffset: start - first.start,
                    endContainer: last.node, endOffset: end - last.start
                });
                ranges.push(range);
                wordHighlights.add(range);
            }
        }
        if (ranges.length) phraseRanges.set(row, ranges);
    }

    function updateLogRow(root) {
        const messages = root.querySelectorAll(SELECTORS.logMessages);
        if (!messages.length) applyHighlight(root, 'row-background', null);
        messages.forEach(message => {
            styleLogMessage(message);
            message.querySelectorAll(SELECTORS.logActivityNames).forEach(el => {
                applyHighlight(el, 'text-color', adminColorFor(el.textContent.trim()));
            });
        });
        highlightPhrases(root, messages);
        stylePlayerRows(root);

        root.querySelectorAll(SELECTORS.logNoteFlags).forEach(styleNoteFlag);
        root.querySelectorAll(SELECTORS.logTimestamps).forEach(applyTimestamp);
        root.querySelectorAll('a[href^="/rcon/servers/"]').forEach(styleServerName);
    }

    function styleNoteFlag(icon) {
        if (icon.classList.contains('glyphicon-comment')) {
            applyHighlight(icon, 'text-color', '#fff');
            return;
        }
        if (icon.style.color) return;
        const label = (
            icon.getAttribute('title') ||
            icon.getAttribute('aria-label') ||
            icon.closest('[title]')?.getAttribute('title') ||
            icon.closest('[aria-label]')?.getAttribute('aria-label') ||
            ''
        ).toLowerCase();
        const isNoteFlag = (label.includes('note') || label.includes('flag')) && icon.textContent.trim().length < 3;
        applyHighlight(icon, 'text-color', isNoteFlag ? state.config.colors.cNoteColorIcon : null);
    }

    const cblRequests = new Map();

    function requestCBL(steamID) {
        const cached = cblRequests.get(steamID);
        if (cached && Date.now() < cached.expires) return cached.promise;
        const query = {
            query: `query Search($id: String!) { steamUser(id: $id) { riskRating, activeBans: bans(expired: false) { edges { node { id } } }, expiredBans: bans(expired: true) { edges { node { id } } } } }`,
            variables: { id: steamID }
        };
        const request = { expires: Infinity };
        request.promise = fetchJSON('cbl', CBL_ENDPOINT, 'CBL GraphQL', {
            steamID,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(query),
            signal: window.AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        }).then(data => {
            if (data?.data && !data.errors?.length) {
                request.expires = Date.now() + CACHE_TTL_MS;
                for (const [id, entry] of cblRequests) {
                    if (entry.expires <= Date.now()) cblRequests.delete(id);
                }
            } else {
                cblRequests.delete(steamID);
            }
            return data;
        });
        cblRequests.set(steamID, request);
        return request.promise;
    }

    async function fetchCBLData(profile, container) {
        const { steamID, steamCell, path } = profile;
        const data = await requestCBL(steamID);
        if (playerProfile !== profile || !container.isConnected || window.location.pathname !== path
            || !steamCell.isConnected || steamCell.textContent.trim() !== steamID) return;

        if (!data?.data || data.errors?.length) {
            container.textContent = 'CBL: Lookup unavailable';
            return;
        }
        const user = data.data.steamUser;
        if (!user) {
            container.textContent = 'CBL: Not Found';
            return;
        }
        const { riskRating, activeBans, expiredBans } = user;
        const score = typeof riskRating === 'string' && riskRating.trim() ? Number(riskRating) : riskRating;
        const active = Array.isArray(activeBans?.edges) ? activeBans.edges.length : 0;
        const expired = Array.isArray(expiredBans?.edges) ? expiredBans.edges.length : 0;
        const rating = document.createElement('span');
        if (Number.isFinite(score) && score >= 0 && score <= 10) {
            rating.style.color = score > 5 ? '#ff7070' : score > 0 ? 'orange' : 'white';
            rating.textContent = `CBL: ${score}/10`;
        } else {
            rating.textContent = 'CBL: Rating unavailable';
        }
        container.replaceChildren(rating, ` | Act: ${active} | Exp: ${expired}`);
    }

    function* readIdentifiers(table) {
        for (const row of table.querySelectorAll(SELECTORS.identifierRows)) {
            const type = row.querySelector(SELECTORS.identifierType)?.textContent.trim();
            const valueCell = row.querySelector(SELECTORS.identifierValue);
            if (type !== undefined && valueCell) {
                yield { row, type, valueCell, value: valueCell.textContent.trim() };
            }
        }
    }

    function copyPlayerInfo() {
        const identifiersTable = document.querySelector(SELECTORS.playerPage)?.querySelector(SELECTORS.playerInfoTable);
        if (!identifiersTable) {
            console.error("BMUS_ERROR: Could not find identifiers table.");
            return;
        }

        const allIdentifiers = [];
        for (const { row, type, value } of readIdentifiers(identifiersTable)) {
            const time = row.querySelector(SELECTORS.identifierLastSeen);
            if (time) {
                allIdentifiers.push({ type, value, timestamp: new Date(time.getAttribute('datetime')) });
            }
        }

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

    let playerProfile;

    function setupPlayerPage(page) {
        let actionsContainer = page.querySelector(SELECTORS.actionsContainer);
        const path = window.location.pathname;
        const table = page.querySelector(SELECTORS.playerInfoTable);
        if (!table) {
            actionsContainer?.remove();
            return;
        }

        let steamCell;
        let steamID;
        for (const { type, value, valueCell } of readIdentifiers(table)) {
            if (type === 'Steam ID' && /^765\d{14}$/.test(value)) {
                steamCell = valueCell;
                steamID = value;
                break;
            }
        }

        const sameIdentifiers = playerProfile?.table === table
            && playerProfile.steamCell === steamCell && playerProfile.steamID === steamID;
        if (sameIdentifiers && playerProfile.path !== path) {
            // The URL changed before the previous player's table finished updating.
            actionsContainer?.remove();
            return;
        }

        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.id = SELECTORS.actionsContainer.substring(1);
            table.before(actionsContainer);
        }

        if (!actionsContainer.querySelector(SELECTORS.copyInfoButton)) {
            const btn = document.createElement('button');
            btn.id = SELECTORS.copyInfoButton.substring(1);
            btn.type = 'button';
            btn.textContent = '📋 Copy';
            btn.title = 'Copy Player Info';
            btn.addEventListener('click', copyPlayerInfo);
            actionsContainer.appendChild(btn);
        }

        const existing = actionsContainer.querySelector(SELECTORS.cblInfoContainer);
        if (existing && sameIdentifiers) return;

        playerProfile = { path, table, steamCell, steamID };
        existing?.remove();
        const result = document.createElement(steamID ? 'a' : 'span');
        result.id = SELECTORS.cblInfoContainer.substring(1);
        result.textContent = steamID ? 'Loading CBL…' : 'CBL: Steam ID not found';
        if (steamID) {
            result.href = `https://communitybanlist.com/search/${steamID}`;
            result.target = '_blank';
            result.rel = 'noopener noreferrer';
        }
        actionsContainer.appendChild(result);
        if (steamID) void fetchCBLData(playerProfile, result);
    }

    function updateOrgEditPage(page) {
        page.querySelectorAll(SELECTORS.orgRoleList).forEach(li => {
            if (li.dataset.modified) return;
            const textNode = Array.from(li.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
            if (textNode) li.insertBefore(document.createTextNode(' ||| '), textNode.nextSibling);
            li.dataset.modified = 'true';
        });
    }

    function updateBanHref(link) {
        if (link.getAttribute('href') !== BAN_TARGET) link.setAttribute('href', BAN_TARGET);
    }

    function setupBanButton(nav) {
        if (!nav.dataset.bmusBanIntercept) {
            nav.dataset.bmusBanIntercept = 'true';
            nav.addEventListener('click', (event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                const link = event.target?.closest?.(BAN_LINK);
                if (!link || !nav.contains(link)) return;
                updateBanHref(link);
                event.preventDefault();
                event.stopPropagation();
                const query = new window.URLSearchParams(window.location.search);
                const alreadyThere = window.location.pathname === BAN_PATH
                    && query.get('filter[organization]') === String(BM_ORG_ID)
                    && query.get('filter[expired]') === 'true';
                if (!alreadyThere) window.location.assign(BAN_TARGET);
            });
        }

        nav.querySelectorAll(BAN_LINK).forEach(banButton => {
            updateBanHref(banButton);
            if (!banButton.dataset.modified) banButton.dataset.modified = 'true';
        });
    }

    const pending = new Map();
    const grids = new Map();
    let frameScheduled = false;
    let observedPath = window.location.pathname;

    function mutationElement(record) {
        return record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
    }

    function queue(element, update) {
        pending.set(element, update);
        if (frameScheduled) return;
        frameScheduled = true;
        window.requestAnimationFrame(() => {
            frameScheduled = false;
            for (const [target, run] of pending) {
                if (target.isConnected) run(target);
            }
            pending.clear();
        });
    }

    function queueRow(row) {
        queue(row, updateLogRow);
    }

    function queueGrid(root) {
        for (const row of root.children) queueRow(row);
    }

    function mountGrid(root) {
        if (grids.has(root)) return;
        const rowFor = element => {
            while (element && element !== root) {
                if (element.parentElement === root) return element;
                element = element.parentElement;
            }
            return null;
        };
        const observer = new MutationObserver(records => {
            for (const record of records) {
                const element = mutationElement(record);
                const time = element?.closest('time');
                if (time?.dateTime.startsWith('P')) continue;
                if (record.attributeName === 'datetime' && time) {
                    queue(time, applyTimestamp);
                    continue;
                }
                const row = rowFor(element);
                if (row) {
                    queueRow(row);
                } else if (element === root) {
                    for (const removed of record.removedNodes) {
                        pending.delete(removed);
                        clearPhraseRanges(removed);
                    }
                    for (const added of record.addedNodes) {
                        if (added.nodeType === Node.ELEMENT_NODE && added.parentElement === root) queueRow(added);
                    }
                }
            }
        });
        observer.observe(root, {
            childList: true, subtree: true, characterData: true,
            attributes: true, attributeFilter: ['datetime', 'href']
        });
        grids.set(root, observer);
        queueGrid(root);
    }

    const watched = [
        [SELECTORS.logContainer, mountGrid],
        [SELECTORS.serverNameDisplays, styleServerName],
        [SELECTORS.playerPage, setupPlayerPage],
        [SELECTORS.orgEditPage, updateOrgEditPage],
        [SELECTORS.rconNav, setupBanButton]
    ];
    const localViews = watched.slice(1);

    function discover(root) {
        for (const [selector, update] of watched) {
            if (root.matches?.(selector)) queue(root, update);
            root.querySelectorAll(selector).forEach(element => queue(element, update));
        }
    }

    function updatePage(records) {
        const path = window.location.pathname;
        if (path !== observedPath) {
            observedPath = path;
            const page = document.querySelector(SELECTORS.playerPage);
            if (page) queue(page, setupPlayerPage);
        }
        let removedElements = false;
        for (const record of records) {
            const target = mutationElement(record);
            if (!target || target.closest(SELECTORS.actionsContainer)) continue;
            const grid = target.closest(SELECTORS.logContainer);
            if (grid && grids.has(grid)) continue;
            if (grid) queue(grid, mountGrid);
            for (const [selector, update] of localViews) {
                const scope = target.closest(selector);
                if (scope) queue(scope, update);
            }
            for (const node of record.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) discover(node);
            }
            for (const node of record.removedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) removedElements = true;
            }
        }
        if (!removedElements) return;
        for (const [root, observer] of grids) {
            if (root.isConnected && root.matches(SELECTORS.logContainer)) continue;
            observer.disconnect();
            grids.delete(root);
            for (const row of root.children) clearPhraseRanges(row);
        }
        for (const row of phraseRanges.keys()) {
            if (!row.isConnected) clearPhraseRanges(row);
        }
        if (playerProfile && !playerProfile.table.isConnected) playerProfile = undefined;
    }

    function refreshAdminColors() {
        state.adminColors = buildAdminColorMap(state.config, state.adminLists);
        for (const root of grids.keys()) queueGrid(root);
    }

    function setAdmins(admins) {
        state.adminLists = admins;
        refreshAdminColors();
    }

    function setTerms(terms, isRemote) {
        state.config = { ...DEFAULT_TERMS, ...terms, colors: { ...DEFAULT_TERMS.colors, ...terms.colors } };
        state.logRules = buildLogRules(state.config);
        state.serverColors = buildServerColors(state.config);
        refreshAdminColors();
        document.querySelectorAll(SELECTORS.serverNameDisplays).forEach(el => queue(el, styleServerName));
        const remoteVersion = terms.chrome_extension_version;
        if (isRemote && remoteVersion && !versionsEqual(remoteVersion, EXTENSION_VERSION)
            && !document.getElementById('bmus-version-warning')) {
            showVersionMismatchWarning(EXTENSION_VERSION, remoteVersion, 'An update is available for your BattleMetrics extension.');
        }
    }

    function loadConfig(operation, url, label, defaults, validate, apply) {
        const cached = readCache(url, validate);
        apply(cached?.data || defaults, Boolean(cached));
        if (!cached || Date.now() - cached.timestamp >= CACHE_TTL_MS) {
            void refreshConfig(operation, url, label, validate).then(data => {
                if (data && JSON.stringify(data) !== JSON.stringify(cached?.data || defaults)) apply(data, true);
            }).catch(error => log(1, error));
        }
    }

    function main() {
        if (document.getElementById(STYLE_ID)) return;
        injectGlobalCSS();
        if (wordHighlights) window.CSS.highlights.set('bmus-keyword', wordHighlights);
        loadConfig('terms', DATA_SOURCES.customConfig, 'Custom Config', DEFAULT_TERMS, isTermConfig, setTerms);
        loadConfig('admins', DATA_SOURCES.adminList, 'Admin List', DEFAULT_ADMINS, isAdminConfig, setAdmins);
        discover(document);
        new MutationObserver(updatePage).observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['href']
        });
    }

    main();
})();
