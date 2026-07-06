## About This Repository
This project is a real-time Chrome extension and Tampermonkey userscript for Battlemetrics.com. It was created as a passion project to help server admins better moderate their communities and read the logs of active servers in games with dozens of online users.

It's free and open source — please consider leaving a coffee at [ko-fi.com/synarion](https://ko-fi.com/synarion) if you'd like.

## Features

### Log Viewer
- **Keyword highlighting** — Color-code log messages based on configurable phrases (admin actions, team kills, warnings, kicks, bans, custom triggers).
- **Admin name coloring** — Staff names are highlighted in 3 distinct colors based on their group, with clan tag/prefix stripping for accurate matching.
- **Join/leave dimming** — Gray out repetitive join/leave events to focus on what matters.
- **Timestamp tooltips** — Hover over any timestamp to see the full localized date and exact time down to the second.
- **Server name coloring** — Color-code server names (e.g. green for Server #1, yellow for Server #2) for quick identification.
- **Note/flag icon highlighting** — Default note icons are colorized for better visibility when scanning player lists.

### Player Profiles
- **Copy player info** — One-click copy button captures Name, Steam ID, EOS ID, and BM profile URL to clipboard.
- **CBL integration** — Automatic [CommunityBanList.com](https://communitybanlist.com/) lookup displays risk rating, active bans, and expired bans for any Steam profile.

### Organization Management
- **Ban button redirect** — Ban page link automatically filters to your organization's ban list instead of "unsorted."
- **Organized flags** — Flag lists are restructured for orgs with many flags, reducing vertical scrolling.
- **Role list formatting** — Adds separators to role member lists on the org edit page for easier reading.
- **RCON warning fix** — Prevents the "RCON disabled" banner from overflowing over collapsed servers.

### Real-Time Configuration
- **Remote JSON configs** — Admin lists and keyword sets are fetched from GitHub-hosted JSON files, allowing real-time updates without reinstalling the extension or userscript.
- **Version checking** — Displays a full-screen warning overlay when a new script version is available, ensuring your entire org stays updated.
- **No page refresh** — Uses a MutationObserver to apply all enhancements as you navigate and as new log entries appear in real time.

### Developer-Friendly
- **Dual build targets** — Ships as both a Chrome Extension (Manifest V3) and a Tampermonkey userscript from a single source file. The Tampermonkey userscript also works on mobile browsers with userscript support (e.g., Brave, Kiwi).
- **Modular configs** — Point `adminList.json` and `termList.json` to your own repo to separate permissions from script code.
- **Admin list pipeline** — Automated scripts to fetch org members from Battlemetrics API, group by role, and resolve SteamIDs to names.
- **Build script** — `node minify.js` runs ESLint, minifies via Terser, and generates both extension and userscript outputs in one run.
- **Tested** — Confirmed working in Squad and Arma Reforger communities; likely compatible with other Battlemetrics-supported games.

## Getting Started

### Option A: Chrome Extension

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `builds/chrome_extension/` folder.
5. The extension is now active on `battlemetrics.com`. Pin it for easy access.

### Option B: Tampermonkey Userscript

1. Install the [Tampermonkey extension](https://www.tampermonkey.net/) for your browser.
   > On Chrome, also enable **Developer mode** and **Userscript** permission under Tampermonkey's extension settings.
2. Open the file `builds/tampermonkey_userscript/bm-enhanced.min.js` in a text editor and copy its contents.
3. Click the Tampermonkey icon → **Create a new script**.
4. Replace the default template with the copied code and save (Ctrl+S).
5. The script will run automatically on Battlemetrics.

### Customizing for Your Organization

1. **`src/config/termList.json`** — Set your org ID, server names, keywords, colors, and admin name prefixes.
2. **`src/config/adminList.json`** — Define admin groups (group1, group2, group3) with player names. You can fill this in by hand, or use the optional automated pipeline below.
3. Update `DATA_SOURCES` in `src/source.js` to point to your own hosted JSON files.
4. Run `node minify.js` to rebuild both the extension and userscript outputs.
5. Edit `@updateURL` and `@downloadURL` in `builds/tampermonkey_userscript/template.user.js` to point to your hosted file, then run `node minify.js` to rebuild. Host the resulting `builds/tampermonkey_userscript/bm-enhanced.min.js` on your server or GitHub repo. This enables automatic updates for your users.

### Automating the Admin List (Optional)

> This entire pipeline and `.env` setup is **optional**. If you prefer, just edit `src/config/adminList.json` by hand — paste player names into the three groups and skip straight to `node minify.js`. The pipeline exists for orgs that want to keep the list in sync automatically.

The admin list pipeline automates building `src/config/adminList.json` from your Battlemetrics org. It runs in 3 stages from `admin_list/`:

```
cd admin_list
node buildAdminList.js
```

#### Prerequisites — `.env` (optional)

Copy `example.env` to `.env` in the project root. All three variables are required only if using `buildAdminList.js`. `.env` is gitignored — never commit it.

##### `BM_TOKEN` — Battlemetrics API Bearer Token

*Used by: `helpers/fetchAdmin.js`*

1. Sign in at [https://www.battlemetrics.com/developers](https://www.battlemetrics.com/developers).
2. Create a **Personal Access Token**. Battlemetrics uses OAuth 2.0 Bearer tokens for API authorization.
3. Select the minimum required scope. The pipeline only calls one read-only endpoint:
   ```
   GET https://api.battlemetrics.com/organizations/{ORG_ID}?include=organizationUser
   ```
   Grant access to **organization data** (no ban, server, or write permissions needed).
4. Copy the generated token and paste it as `BM_TOKEN=` in your `.env`.

> Scopes are restrictive — they limit what the token can do. A broad scope (e.g., `organization`) permits all organization actions; a narrower scope (e.g., `organization:read`) further restricts to read-only. Either works.

##### `ORG_ID` — Your Battlemetrics Organization ID

*Used by: `helpers/fetchAdmin.js`*

1. Go to your organization's page on Battlemetrics (e.g., `https://www.battlemetrics.com/rcon/org/58064`).
2. The number in the URL is your **ORG_ID**. Paste it as `ORG_ID=` in your `.env`.
3. This ID tells the API which organization's member list to pull.

> Tip: You can also find it under **Account → Organizations** — hover or click your org name and grab the ID from the link.

##### `STEAM_API_KEY` — Steam Web API Key

*Used by: `helpers/getSteamName.js`*

1. Go to [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) and sign in.
2. If you don't have one yet, fill in the domain field (use `localhost` if running locally) and click **Register**.
3. Copy the 32-character hex key and paste it as `STEAM_API_KEY=` in your `.env`.
4. Step 3 of the pipeline uses this key to call `ISteamUser/GetPlayerSummaries`, resolving each admin's SteamID to their Steam profile name so `adminList.json` contains human-readable names instead of raw IDs.

> Steam rate-limits this API. The pipeline respects the limit with 3-second delays between requests and caches results in `helpers/steam-name-cache.json` so subsequent runs only fetch new users.

#### Pipeline Stages

**Step 1: `helpers/fetchAdmin.js`** — Uses `dotenv` to load `.env`, then calls the Battlemetrics API:
```
GET https://api.battlemetrics.com/organizations/{ORG_ID}?include=organizationUser
Authorization: Bearer {BM_TOKEN}
```
Raw JSON is saved to `helpers/admin-data.json` (gitignored). On failure, the error is logged to `helpers/admin-data-error.txt`.

**Step 2: `helpers/parseAdmin.js`** — Reads the raw data, filters out nicknames listed in `helpers/blacklistConfig.json`, extracts only users with SteamIDs, then groups them by Battlemetrics role:
- **Group 3** — Director, or users holding Reforger Admin + Squad roles
- **Group 2** — Reforger Admin only
- **Group 1** — Squad Admin or Squad Moderator

Writes SteamIDs to `src/config/adminList.json` and a human-readable debug log to `helpers/admin-parse-debug.txt`.

**Step 3: `helpers/getSteamName.js`** — Loads `STEAM_API_KEY` from `.env`, reads the SteamIDs from step 2, and resolves each one to a Steam profile name via the Steam Web API (`ISteamUser/GetPlayerSummaries`). Uses a persistent cache (`helpers/steam-name-cache.json`, gitignored) so subsequent runs only fetch new/uncached IDs. Rate-limited at 3s per request with 3 retries on failure. Overwrites `src/config/adminList.json` with resolved names.

### Requirements

| | Chrome Extension | Tampermonkey |
|---|---|---|
| Browser | Chrome/Edge/Brave (v130+) | Chrome v120+ or Firefox 78+ |
| Dev Mode | Required | Not required |
| Permissions | Limited to battlemetrics.com, communitybanlist.com, raw.githubusercontent.com | All sites (Tampermonkey default) |

## Contributions & Notes For Devs

### Versioning

Four files carry version numbers. Here's what each controls:

| File | Version | Purpose | Auto-managed? |
|---|---|---|---|
| `src/source.js:2` — `EXTENSION_VERSION` | `"3.01"` | **Single source of truth.** The build script extracts this value and injects it into the Tampermonkey output. Bump this on every release. | Manual |
| `src/config/termList.json:2` — `"version"` | `"3.01"` | Should match `EXTENSION_VERSION` (comment at line 1). Purely informational. | Manual |
| `src/config/termList.json:3` — `"chrome_extension_version"` | `"3.01"` | **Runtime version check.** Every time the script loads, it fetches this JSON remotely and compares it against the local `EXTENSION_VERSION`. If they differ, a full-screen warning overlay tells users to update. Must match `EXTENSION_VERSION` or the check fires. | Manual |
| `builds/chrome_extension/manifest.json:5` — `"version"` | `"3.01"` | Chrome's extension manifest. **Auto-updated** by the build script. `EXTENSION_VERSION` is parsed as a number (e.g. `"3.01"` → `3.01`) and written here. | Automated by `minify.js` |
| `builds/tampermonkey_userscript/template.user.js:5` — `@version` | (auto-filled) | The build script (`minify.js`) extracts `EXTENSION_VERSION` from source.js via regex and replaces the `@version` line in the output automatically. Never edit this manually. | Automated by `minify.js` |
| `package.json:3` — `"version"` | `"3.0"` | npm package metadata only. Not consumed by any build or runtime logic. | Manual |

**Update dependencies:** `npm run update` checks the npm registry for each dependency. Any package whose latest version was published within the last **7 days** is skipped — a supply chain security buffer to avoid pulling in freshly published releases that haven't had community vetting time. The buffer is defined in `scripts/update-deps.js:6`.

**When releasing:** bump `EXTENSION_VERSION` in `source.js`, update both `version` and `chrome_extension_version` in `termList.json` to match, then run `node minify.js` to regenerate all build outputs (including manifest.json and Tampermonkey `@version`).

### Development Notes
- Only code you should modify is [ src/source.js | config/adminList.json | config/termList.json ] as the minify.js will handle the rest. You can run minify.js locally before pushing, or rely on the Github Action to run it.
- [LiQ Gaming](https://liqgaming.com/#/) - Avengerian (time seconds), Got2bHockey (Github Actions & Fixes)
- /GmG\ - Eddie (button fixes and CBL bits)
- This project's scope is limited to reading/modifying the **locally** delivered web content and locally injecting CSS and web improvements without touching the BM API (as such this code could run offline). Code suggestions that automates or performs interactive API requests like bans, kicks and queries using your Battlemetrics tokens will not be merged into this project as that approaches being a self-bot which could result in your BM account being suspended. Add such code at your own risk.
- Auto updating isn't functional due to changes in Chrome Manifest V3, there are some possible workarounds and sadly have been proven to be challenging to get working. Instead of auto updating the entire script, it pulls from JSON files which is tad safer and allows for updating in real time without forcing clients/machines to update. In general the extension/scripts should only need to be updated during feature/breaking updates. 

