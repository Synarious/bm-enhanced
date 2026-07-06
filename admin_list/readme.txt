=== Admin Username Fetch Pipeline ===

All pipeline scripts live in this directory. Run from admin_list/:

  node buildAdminList.js        # Runs all three stages in sequence

Or step by step:

  node helpers/fetchAdmin.js    # Step 1: pull org data from Battlemetrics API
  node helpers/parseAdmin.js    # Step 2: filter, group by role, write adminList.json
  node helpers/getSteamName.js  # Step 3: resolve SteamIDs to Steam profile names

Stages:

  1. helpers/fetchAdmin.js  — Fetches org member data from Battlemetrics.
     Requires: BM_TOKEN and ORG_ID in ../../.env
     Output: helpers/admin-data.json

  2. helpers/parseAdmin.js  — Parses raw data, applies blacklistConfig.json,
     extracts SteamIDs, and groups by role (Group 3 = highest).
     Input: helpers/admin-data.json, helpers/blacklistConfig.json
     Output: ../../src/config/adminList.json (SteamIDs), helpers/admin-parse-debug.txt

  3. helpers/getSteamName.js — Resolves SteamIDs to Steam profile names.
     Requires: STEAM_API_KEY in ../../.env
     Input: ../../src/config/adminList.json, helpers/steam-name-cache.json
     Output: ../../src/config/adminList.json (overwrites with Steam names),
             helpers/processed_adminList.json (audit copy)

Helper data files (gitignored):

  helpers/admin-data.json          — raw API response
  helpers/admin-data-error.txt     — API error dump
  helpers/admin-parse-debug.txt    — human-readable role mapping
  helpers/steam-name-cache.json    — cached Steam name lookups
  helpers/processed_adminList.json — audit copy with resolved names

Config:

  helpers/blacklistConfig.json     — Battlemetrics nicknames to exclude

The extension overwrites ../../src/config/adminList.json which is finalized web served list scripts use.
