const version = "3.00" // Changing this version is what causes updates. A higher number = update.
const updateRate = "65" // ms Overall rate to run the code at.
const bmORG_ID = "58064" // Used for ban shortcut, use the # ID in URL of your org's main ban filter on BM..
const versionSource = "https://raw.githubusercontent.com/Synarious/bm-userscript/unnamed/bm-toolkit-desktop.min.js" // link to raw github article.
const admistlistSource = "https://raw.githubusercontent.com/Synarious/bm-userscript/refs/heads/unnamed/adminList.json" // file is found in your repo by default.
const serverName1 = "TPS" // 1 and 2 Used for coloring of server names in banlist.
const serverName2 = "[NA]"

// Quick Button Settings
const cornerBTname = "R"
const dropdownOptions = [{
    label: "Server 1",
    url: "https://www.battlemetrics.com/rcon/servers/31707876"
},
{
    label: "Server 2",
    url: "https://www.battlemetrics.com/rcon/servers/31707887"
},
{
    label: "Server 3",
    url: "https://www.battlemetrics.com/rcon/servers/31707886"
},
{
    label: "Server 4",
    url: "https://www.battlemetrics.com/rcon/servers/31707874"
},
{
    label: "Server 5",
    url: "https://www.battlemetrics.com/rcon/servers/31490334"
},
{
    label: "Server 6",
    url: "https://www.battlemetrics.com/rcon/servers/31517967"
},
{
    label: "Server 7",
    url: "https://www.battlemetrics.com/rcon/servers/31569933"
},
{
    label: "Server 8",
    url: "https://www.battlemetrics.com/rcon/servers/31707874"
},
{
    label: "Server 9",
    url: "https://www.battlemetrics.com/rcon/servers/31879399"
},
];

const sets = {
    teamKilled: new Set(["team killed"]),
    grayedOut: new Set([
        "You were teamkilled!",
        "Please revive the player if you can.) by Trigger.",
        "You MUST apologize for your teamkills in all chat!",
        "(Welcome to the Unnamed!",
        "Support us on our Tebex",
        "Welcome back to the Unnamed",
        "(Welcome to the Unnamed!",
        "Support us on our Tebex",
        "console key (",
        "Shout out to our Only Fans",
        "warned (theunnamedcorp.com)",
        "| Please grab a squad leader",
        "make fun of your friends! theunnamedcorp",
        "Join a squad, you are are unassigned",
        "Seeding Reward",
        "Acknowledged - Provide Evidence to Discord",
        "Trigger removed flag",
        "Kicked player",
        "(Vibez was the",
        "Be sure to leave a tip for that peep",
        "(You have entered this",
        "Server Population: ",
        "Ban Log: ",
    ]), // this grays out unimportant messages.
    trackedTriggers: new Set(["[SL Kit]"]),
    leftServer: new Set(["left the server"]),
    joinedServer: new Set(["joined the server"]),
    actionList: new Set([
        "was warned",
        "was kicked",
        "was banned",
        "edited BattleMetrics Ban",
        "added BattleMetrics Ban",
        "deleted BattleMetrics Ban",
    ]),

    factionGroup1: new Set([
        "Australian Defence Force",
        "British Armed Forces",
        "Canadian Armed Forces",
        "United States Army",
        "United States Marine Corps",
        "Turkish Land Forces",
    ]),

    factionGroup2: new Set([
        "Russian Ground Forces",
        "Middle Eastern Alliance",
        "Middle Eastern Insurgents",
        "Insurgent Forces",
        "Irregular Militia Forces",
        "People's Liberation Army",
        "Russian Airborne Forces",
        "PLA Navy Marine Corps",
        "PLA Amphibious Ground Forces",
    ]),

    factionGroup3: new Set([
        "Western Private Military Contractors"
    ]),

    adminTerms: new Set([
        "admin",
        "Admin",
        "ADMIN",
        "aDMIN",
        "AdMIN",
        "to the other team.",
        ") was disbanded b",
        "requested a list of squads.",
        "set the next map to",
        "changed the map to",
        "requested the next map.",
        "AdminRenameSquad",
        "(Global)",
        "executed Player Action ⚠️",
        "Teleported to",
        "You have made admin squads",
    ]),
};

const colors = {
    cStaffGroup1: "#00fdff",
    cStaffGroup2: "#00ff5c",
    cStaffGroup3: "#00ffbb",
    cFactionGroup1: "#4eacff",
    cFactionGroup2: "#d0b1ff",
    cFactionGroup3: "#fd6aff",
    cModAction: "#ff3333",
    cAdminAction: "#37ff00",
    cTeamKilled: "#ffcc00",
    cLeftServer: "#d9a6a6",
    cJoined: "#919191",
    cGrayed: "#919191",
    cTracked: "#FF931A",
    cNoteColorIcon: "#f5ccff"
}; // This is the color scheme for the script, change to your liking.
