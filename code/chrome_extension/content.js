
const version = "3.00" // Changing this version is what causes updates. A higher number = update.
const bmORG_ID = "58064" // Used for ban shortcut, use the # ID in URL of your org's main ban filter on BM..
const versionSource = "https://raw.githubusercontent.com/Synarious/bm-userscript/unnamed/bm-toolkit-desktop.min.js" // link to raw github article.
const adminListSource = "https://raw.githubusercontent.com/Synarious/bm-userscript/refs/heads/unnamed-ce/adminList.json" // file is found in your repo by default.
const customConfigSource = "https://raw.githubusercontent.com/Synarious/bm-userscript/refs/heads/unnamed-ce/termList.json" // file is found in your repo by default.
const updateRate = "65" // ms Overall rate to run the code at.
const sets = {}; // globally accessible sets object


async function fetchConfig() {
    const response = await fetch(customConfigSource);
    if (!response.ok) {
        console.error("🚫|Failed to fetch configuration.");
        return null;
    }
    return await response.json();
}

async function applyLogStyles() {
    console.log("✅|BMUS: Running initial one-time code...");

    // Fetch the config from the source
    const config = await fetchConfig();
    console.log("✅|BMUS: Loaded Configuration:", config);

    // Destructure values from the config for easier use
    const { sets, colors, serverName1, serverName2, updateRate } = config;

    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        // Mobile devices check (quick buttons disabled for mobile)
    }

    const updateLogic = async () => {
        await new Promise(resolve => setTimeout(resolve, updateRate)); // Avoid overlap
        const elements = document.querySelectorAll('.ReactVirtualized__Grid__innerScrollContainer, .css-b7r34x');
        if (elements.length) {
            applyTimeStamps();
            logColoring(config);
        }
    };

    const applyTimeStamps = () => {
        document.querySelectorAll(".css-z1s6qn").forEach(element => {
            const utcTime = element.getAttribute("datetime");
            if (utcTime) {
                const date = new Date(utcTime);
                if (!isNaN(date.getTime())) {
                    element.setAttribute("title", date.toLocaleString(undefined, { timeZoneName: 'short' }));
                }
            }
        });
    };

    try {
        const response = await fetch(adminListSource);
        if (!response.ok) throw new Error(`🚫|Failed to fetch CONST adminListSource: ${response.statusText}`);
        const data = await response.json();
        sets.adminList1 = new Set(data.group1);
        sets.adminList2 = new Set(data.group2);
        sets.adminList3 = new Set(data.group3);
        console.log("🛡️|BMUS: adminList1 updated:", sets.adminList1);
        console.log("🛡️|BMUS: adminList2 updated:", sets.adminList2);
        console.log("🛡️|BMUS: adminList3 updated:", sets.adminList3);
    } catch (error) {
        console.error("🚫|Error fetching admin list:", error);
        console.log("adminListSource:", adminListSource);
    }
    
    const logColoring = () => {
        const colorSets = {
            messageLog: document.querySelectorAll(".css-ym7lu8"),
            namePlayers: document.querySelectorAll(".css-1ewh5td"),
            nameActivity: document.querySelectorAll(".css-fj458c"),
            bmAdmin: document.querySelectorAll(".css-18s4qom"),
            bmNoteFlag: document.querySelectorAll(".css-he5ni6"),
            conflictElements: document.querySelectorAll(".css-1ymmsk5")
        };

        const applyColor = (elements, set, color) => {
            elements.forEach((element) => {
                for (let phrase of set) {
                    if (element.textContent.includes(phrase)) {
                        element.style.color = color;
                        break;
                    }
                }
            });
        };

        const adminApplyColor = (elements, phrases, color) => {
            if (!elements || !phrases) return; // defensive

            elements.forEach(el => {
                // Convert Set or array to array
                const phraseList = Array.isArray(phrases) ? phrases : Array.from(phrases);
                phraseList.forEach(phrase => {
                    const regex = new RegExp(`(?<=^|[\\s\\p{P}])${phrase.replace(/{/g, '\\{').replace(/}/g, '\\}')}(?=$|[\\s\\p{P}])`, "iu");
                    if (regex.test(el.textContent)) {
                        el.style.color = color;
                    }
                });
            });
        };
        // Apply colors based on phrases (from config.sets and config.colors)
        applyColor(colorSets.messageLog, sets.joinedServer, colors.cJoined);
        applyColor(colorSets.messageLog, sets.leftServer, colors.cLeftServer);
        applyColor(colorSets.messageLog, sets.actionList, colors.cModAction);
        applyColor(colorSets.messageLog, sets.adminTerms, colors.cAdminAction);
        applyColor(colorSets.messageLog, sets.factionGroup1, colors.cFactionGroup1);
        applyColor(colorSets.messageLog, sets.factionGroup2, colors.cFactionGroup2);
        applyColor(colorSets.messageLog, sets.factionGroup3, colors.cFactionGroup3);
        applyColor(colorSets.messageLog, sets.teamKilled, colors.cTeamKilled);
        applyColor(colorSets.messageLog, sets.trackedTriggers, colors.cTracked);
        applyColor(colorSets.messageLog, sets.grayedOut, colors.cGrayed);


        // Apply colors to player names (for admins)
        adminApplyColor(colorSets.nameActivity, sets.adminList1, colors.cStaffGroup1);
        adminApplyColor(colorSets.namePlayers, sets.adminList1, colors.cStaffGroup1);
        adminApplyColor(colorSets.nameActivity, sets.adminList2, colors.cStaffGroup2);
        adminApplyColor(colorSets.namePlayers, sets.adminList2, colors.cStaffGroup2);
        adminApplyColor(colorSets.nameActivity, sets.adminList3, colors.cStaffGroup3);
        adminApplyColor(colorSets.namePlayers, sets.adminList3, colors.cStaffGroup3);


        // Changes Flag Color For Note On Player List
        colorSets.bmNoteFlag.forEach((element) => {
            element.style.color = colors.cNoteColorIcon;
        });

        // Changes server name colors in banlist
        colorSets.conflictElements.forEach((element) => {
            if (element.textContent.includes(serverName1)) {
                element.style.color = "green";
            } else if (element.textContent.includes(serverName2)) {
                element.style.color = "yellow";
            }
        });
    };

    // Using `requestAnimationFrame` for smooth updates
    const updateLoop = () => {
        updateLogic().then(() => requestAnimationFrame(updateLoop));
    };

    updateLoop(); // Start the loop
}

function injectCSS() {
    const styles = {
        blockMenu: ".navbar-toggle { display: block !important; visibility: visible !important; padding-left: 15%; background: rgb(34, 34, 34);}",
        buttonitself: ".navbar-toggle { display: block !important; visibility: visible !important; padding-left: 15%; background: rgb(34, 34, 34);}",
        removeLogo: ".css-1nxi32t { width: 1px;}",
        disableRCON: ".css-1xkypod { position: unset !important; }",
        banMenuWidthSmall: "@media (max-width: 1099px) and (min-width: 950px) { .css-mxzvlz { width:100% !important } }",
        banMenuWidth: "@media (max-width: 949px) { .css-mxzvlz { width:70% !important } }",
        banInnerMenuWidth: ".css-e70h1 { max-width: 1000px !important;}",
        banMenuReason: "{.css-e70h1 {width: 50em;}",
        mainWidth: ".main { width: 90% !important; margin-left: 4em; margin-right: 4em; } @media (max-width: 768px) { .main { width: inherit !important; }}",
        flagList: ".css-mxzvlz { padding-left: .5em; width: 20%; display: inline-block;}",
        flagHideDetails: ".css-110bni0 {font-size: 0px;}",
        flagListMedium: "@media (max-width: 1099px) and (min-width: 950px) { .css-mxzvlz { width: 33% !important; } }",
        flagListSmall: "@media (max-width: 949px) { .css-mxzvlz { width: 50% !important; } }",
        cblButtonStyle: "@media (max-width: 768px) { .CBL-Button {left: 16em !important; } }"
    };

    // Create a <style> element and inject the CSS into the page
    const styleElement = document.createElement("style");
    styleElement.innerHTML = Object.values(styles).join("\n");

    // Append the <style> element to the <head> of the document
    document.head.appendChild(styleElement);
}

injectCSS();

async function runCornerButtons() {
    console.log("✅|BMUS: Running corner buttons.");

    const updateRate = 300; // Delay in milliseconds between executions
    async function updateLogicSlow() {
        // Avoid overlapping by waiting for the previous execution to finish
        await new Promise(resolve => setTimeout(resolve, updateRate));


        // Start CBL & SteamID of section ------ >
        if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            // console.log("User is on a mobile device. player buttons disabled");
        } else { }

        function cornerButtons() {
            // Check if the corner button container already exists
            const existingButtonContainer = document.getElementById("corner-button-container");
            if (existingButtonContainer) return; // Exit if the container already exists

            const buttons = [
                {
                    id: "version",
                    label: version,
                    url: versionSource,
                    backgroundColor: "black",
                    fontSize: "6pt",
                    textColor: "white"
                }
            ];

            const buttonContainer = Object.assign(document.createElement("div"), {
                id: "corner-button-container", // Give the container a unique ID
                style: "position: fixed; bottom: 0px; right: 0em; z-index: 99999;"
            });
            document.body.appendChild(buttonContainer);

            buttons.forEach(({
                id,
                label,
                url,
                backgroundColor,
                textColor
            }) => {
                // Check if the button already exists
                if (document.getElementById(id)) return; // Skip creating button if it exists

                const button = Object.assign(document.createElement("input"), {
                    type: "button",
                    id,
                    value: label,
                    style: `width: 35px; padding: 2px; font-size: 7pt; background: ${backgroundColor}; color: ${textColor}; border: none; border-radius: 3px;`,
                });
                buttonContainer.appendChild(button);
            });
        }
        cornerButtons();
    }

    // Use recursive setTimeout instead of setInterval to handle async properly
    function runUpdate() {
        updateLogicSlow().then(() => {
            setTimeout(runUpdate, updateRate); // Call again after updateRate time
        });
    }

    // Start the first execution
    runUpdate();
}

async function runBanUpdate() {
    console.log("✅|BMUS: Running ban button update...");

    const updateRate = 300; // Delay in milliseconds between executions

    // Ban button update function
    function banButtonUpdate() {
        const banButton = document.querySelector('a[href="/rcon/bans"]');
        if (banButton) {
            banButton.addEventListener("click", function (event) {
                event.preventDefault(); // Prevents default navigation behavior
                window.location.href = "/rcon/bans?filter%5Borganization%5D=58064";
            });
        }
    }

    async function updateLogicSlow() {
        // Avoid overlapping by waiting for the previous execution to finish
        await new Promise(resolve => setTimeout(resolve, updateRate));
        banButtonUpdate(); // Call the function to update the ban button
    }

    // Use recursive setTimeout instead of setInterval to handle async properly
    function runUpdate() {
        updateLogicSlow().then(() => {
            setTimeout(runUpdate, updateRate); // Call again after updateRate time
        });
    }

    // Start the first execution
    runUpdate();
}

function copyButton() {
    'use strict';

    function monitorPage() {
        const observer = new MutationObserver(() => {
            const playerPageExists = document.querySelector("#RCONPlayerPage");
            const existingButton = document.querySelector("#copy-player-info-btn");

            if (playerPageExists && !existingButton) {
                waitForTableAndInject();
            } else if (!playerPageExists && existingButton) {
                existingButton.remove();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function waitForTableAndInject() {
        const interval = setInterval(() => {
            const table = document.querySelector('tbody');
            const playerPageExists = document.querySelector("#RCONPlayerPage");
            const existingButton = document.querySelector("#copy-player-info-btn");

            if (!playerPageExists) {
                clearInterval(interval);
                return;
            }

            if (table && !existingButton) {
                clearInterval(interval);
                injectButton();
            }
        }, 500);
    }

    function injectButton() {
        const btn = Object.assign(document.createElement('button'), {
            id: 'copy-player-info-btn',
            textContent: '📋 Copy',
            title: 'Copy Player Info',
            style: `
                position: absolute;
                top: 14.35em;
                left: 26em;
                z-index: 1000;
                padding: 4px;
                width: 75px;
                background: rgb(0, 123, 255);
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
            `
        });
        btn.addEventListener('click', copyPlayerInfo);
        document.body.appendChild(btn);
    }

    function copyPlayerInfo() {
        const info = [];

        const nameRow = [...document.querySelectorAll('td[data-title="Type"]')]
            .find(td => td.textContent.includes("Name"))?.parentElement;
        const name = nameRow?.querySelector('td[data-title="Identifier"] span')?.textContent.trim();
        if (name) info.push(`Name: ${name}`);

        const steamRow = [...document.querySelectorAll('td[data-title="Type"]')]
            .find(td => td.textContent.includes("Steam ID"))?.parentElement;
        const steamId = steamRow?.querySelector('td[data-title="Identifier"] span')?.textContent.trim();
        if (steamId) info.push(`SteamID: ${steamId}`);

        const reforgerRow = [...document.querySelectorAll('td[data-title="Type"]')]
            .find(td => td.textContent.includes("Reforger ID"))?.parentElement;
        const reforgerId = reforgerRow?.querySelector('td[data-title="Identifier"] span')?.textContent.trim();
        if (reforgerId) info.push(`Reforger ID: ${reforgerId}`);

        const eosRow = [...document.querySelectorAll('td[data-title="Type"]')]
            .find(td => td.textContent.includes("EOS ID"))?.parentElement;
        const eosId = eosRow?.querySelector('td[data-title="Identifier"] span')?.textContent.trim();
        if (eosId) info.push(`EOS ID: ${eosId}`);

        const currentUrl = window.location.href;
        if (currentUrl) info.push(`BM: <${currentUrl}>`);

        if (info.length === 0) {
            showToast("⚠️ No player info found.");
            return;
        }

        const combined = info.join('\n');
        navigator.clipboard.writeText(combined).then(() => {
            showToast("✅|Player info copied!");
        }).catch(err => {
            console.error("🚫|Clipboard copy failed", err);
            showToast("🚫|Failed to copy.");
        });
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.background = '#333';
        toast.style.color = '#fff';
        toast.style.padding = '10px 15px';
        toast.style.borderRadius = '4px';
        toast.style.zIndex = 10000;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // Start the logic
    monitorPage();
}

// Call the function
copyButton();

async function runCBLCode() {
    console.log("✅|BMUS: Running CBL one-time code.");

    // Add styles for buttons
    addStyles();

    // Start of CBL logic
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        console.log("User is on a mobile device. Quick buttons disabled");
    }

    let isFetching = false;

    // Function to ensure an element exists and create it if not
    function ensureElementExists(elementId, creationFunction) {
        if (!document.getElementById(elementId)) {
            creationFunction();
        }
    }

    // Function to remove an element by ID
    function removeElementById(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.remove();
        }
    }

    // Fetches Steam user data
    async function fetchSteamUserData(steamID) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const maxRetries = 1;
        const retryDelay = 3000;
        let attempt = 0;
        let success = false;

        while (attempt < maxRetries && !success) {
            try {
                attempt++;
                console.log(`CBL API Query ${attempt}: Fetching user data for SteamID ${steamID}`);

                const graphqlEndpoint = "https://communitybanlist.com/graphql"; // Move graphqlEndpoint inside the function

                const response = await fetch(graphqlEndpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: `
                        query Search($id: String!) {
                            steamUser(id: $id) {
                                riskRating
                                activeBans: bans(orderBy: "created", orderDirection: DESC, expired: false) {
                                    edges { node { id } }
                                }
                                expiredBans: bans(orderBy: "created", orderDirection: DESC, expired: true) {
                                    edges { node { id } }
                                }
                            }
                        }`, variables: { id: steamID }
                    })
                });

                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} (${response.statusText})`);

                const data = await response.json();
                const user = data.data.steamUser;
                const riskRating = (user?.riskRating ?? 0);
                const activeBansCount = user?.activeBans?.edges?.length ?? 0;
                const expiredBansCount = user?.expiredBans?.edges?.length ?? 0;

                displayUserData(riskRating, activeBansCount, expiredBansCount);
                success = true;

            } catch (error) {
                console.error(`Attempt ${attempt} failed: ${error.message}`);
                if (attempt < maxRetries) {
                    console.log(`Retrying in ${retryDelay / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    displayUserData("?", "?", "?");
                    success = true;
                }
            }
        }
    }

    function displayUserData(riskRating, activeBansCount, expiredBansCount) {
        const CBL = document.createElement("div");
        CBL.id = "CBL-info";
        CBL.classList.add("CBL-Button");
        CBL.style = `
        display: inline-block; margin-left: 10px; padding: 4px 8px; background: #000000bd; color: white;
        border-radius: 5px; font-size: 14px; font-weight: bold;
    `;

        riskRating = riskRating ?? 0;
        let riskColor = (riskRating >= 1 && riskRating <= 5) ? "orange" : (riskRating > 5 ? "red" : "white");

        CBL.innerHTML = `
        <span style="color: ${riskColor};">CBL: ${riskRating}/10</span>
        <br>
        <span style="font-size: 12px;">Act: ${activeBansCount} / Exp: ${expiredBansCount}</span>
    `;

        const targetSpan = document.querySelector("#RCONPlayerPage > div > div:nth-child(1) > div:nth-child(1) > h2 > span");
        if (targetSpan) {
            targetSpan.after(CBL);
        } else {
            console.warn("CBL: Target span not found. Appending to body as fallback.");
            document.body.appendChild(CBL); // Fallback
        }
    }

    // Creates the button to open CBL page for the user
    function createCopyButton() {
        const copyButton = document.createElement("button");
        copyButton.id = "copy-player-info-btn";
        copyButton.textContent = "Copy Info";
        copyButton.classList.add("copy-info-btn-style");

        // Inline styles instead of absolute positioning
        copyButton.style = `
        margin-left: 10px;
        padding: 5px 10px;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 5px;
        font-weight: bold;
        cursor: pointer;
    `;

        const targetSpan = document.querySelector("#RCONPlayerPage > div > div:nth-child(1) > div:nth-child(1) > h2 > span");
        if (targetSpan) {
            targetSpan.after(copyButton);
        } else {
            console.warn("CBL: Target span not found for copy button. Appending to body.");
            document.body.appendChild(copyButton); // fallback
        }

        // Example click logic – adjust as needed
        copyButton.addEventListener("click", () => {
            const steamID = getInnerTextByTitle("765", "SteamID MISSING?");
            const riskInfo = document.getElementById("CBL-info")?.innerText || "Risk info unavailable";
            const combinedInfo = `SteamID: ${steamID}\n${riskInfo}`;

            navigator.clipboard.writeText(combinedInfo).then(() => {
                alert("Player info copied!");
            }).catch(err => {
                console.error("Copy failed:", err);
            });
        });
    }

    // Inject styles dynamically for buttons
    function addStyles() {
        const styles = `
            .open-url-button-style {
                width: 100px; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
                position: absolute; top: 11.25em; z-index: 99999; left: 13em; background-color: #e5a411;
                border: none; border-radius: 1em;
            }
            .open-url-button-style:hover { background-color: #ffb500; }
            @media (max-width: 768px) { .open-url-button-style { left: 8em; } }
        `;

        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
    }

    // Helper function to get inner text of elements by title
    function getInnerTextByTitle(titlePart, defaultValue) {
        return document.querySelector(`[title*="${titlePart}"]`)?.innerText || defaultValue;
    }

    // Main logic for updating
    async function updateLogic() {
        await new Promise(resolve => setTimeout(resolve, updateRate));

        const playerPageExists = document.querySelector("#RCONPlayerPage");
        if (playerPageExists) {
            ensureElementExists("CBL-info", () => {
                const pSteamID = getInnerTextByTitle("765", "SteamID MISSING?");
                if (pSteamID && pSteamID !== "SteamID MISSING?") {
                    runDataFetching(pSteamID); // Pass SteamID to fetch data
                }
            });
        } else {
            removeElementById("open-url-button");
            removeElementById("CBL-info");
        }
    }

    // Continuously run updateLogic using setInterval
    setInterval(updateLogic, updateRate);

    // Start logic if player page exists
    if (document.querySelector('#RCONPlayerPage')) {
        createCopyButton();
    }

    // Run data fetching function when needed
    async function runDataFetching(steamID) {
        if (isFetching) {
            console.log("CBL script already in progress... Skipping...");
            return;
        }

        isFetching = true;
        try {
            await fetchSteamUserData(steamID);
        } catch (error) {
            console.error("Error fetching Steam user data:", error);
        } finally {
            isFetching = false;
        }
    }
}


function observeDOMChanges() {
    const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                const targetElement1 = document.querySelector('.ReactVirtualized__Grid__innerScrollContainer');
                const targetElement2 = document.querySelector('.container-fluid');
                const targetElement3 = document.querySelector('.list-unstyled');

                if (targetElement1 || targetElement2 || targetElement3) {
                    console.log("✅|BMUS: Target element detected. Starting code...");
                    observer.disconnect(); // Stop observing

                    runBanUpdate();
                    runCornerButtons();
                    applyLogStyles();
                    runCBLCode();

                    break;
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
    });
}
observeDOMChanges();
