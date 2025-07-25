## About This Repository
This project is userscript that began as a way to improve the readability of logs in populated games like Squad. Initially designed to highlight text, it has grown to include over a dozen features and quality-of-life improvements. The project has been rewritten to be easily forked and is now available for free. Primarily a passion project, it has been tested in Squad/Reforger communities and should theoretically work for all Battlemetrics-supported titles.

It's free and open source, please consider leaving a coffee https://ko-fi.com/synarion if you would like. 

## Requirements & Install
Option 1: Chrome Extension (Chrome Only)
- Chrome based browser (v130+ Tested) with **DEV MODE** enable (required).
Option 2: Tampermonkey Extension (Chrome & Firefox/Zen)
- Tampermonkey Browser Extension: [Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=en&pli=1) v120+ OR [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) 78+ (Tested on stable). 

Which is better? For chrome, the extension has reduced permission scope compared to Tampermonkey which has access to all sites by default. I haven't benchmarked them, but I suspect the extension is better than Tampermonkey.

> [!WARNING]
> Chromium browsers (Chrome, Edge, Brave etc..) all require "DEV MODE" enabled in the extension settings area (see "Getting Started" guide below).

## Features Of bm-desktop-auto.min.js
---- All customizable! ----
* Log highlighting for ban, warns and kicks and more.
* Highlights terms involving admin with bright green.
* Highlights those listed as "Admins" on BM.
* Highlights the staff names. Displays both in activity and player list.
* Auto updating (see important note on this below). 
* Color coding ban server.
* Sizing & layout improvements for bans, player look-up and flags.
* "Mostly" working on iOS and Android devices. Assuming you have browser or injector app that supports userscript, there are a few.
* Quick link buttons - access admin resources in one click.
* [CommunityBanList](https://communitybanlist.com/) CBL auto lookup.
* One Click Player Copy - Link, steamID and URL to your clipboard.
* Grays out unimportant events like joins/leaves.
* Color codes server actions, to prevent accidental map changes etc..
* Adds time in seconds to timestamp (when hovering over the tooltip) (LiQ Avengerian)
* Color coded groups, such as for player teams/factions in a game. US vs. RUS etc..
* Fixes "RCON disabled warning" so it doesn't overflow over other servers when many servers are collapsed.

## Getting Started 
### See [Getting Started Wiki](https://github.com/Synarious/bm-userscript/wiki ) on how to install & more.

## Contributions
- [LiQ Gaming](https://liqgaming.com/#/) - Avengerian (time seconds), Got2bHockey (Github Actions)
- /GmG\ - Eddie (button fixes and CBL bits)
- This project's scope is limited to reading/modifying the **locally** delivered web content and locally injecting CSS and web improvements without touching the BM API (as such this code could run offline). Code suggestions that automates or performs interactive API requests like bans, kicks and queries using your Battlemetrics tokens will not be merged into this project as that approaches being a self bot which could result in your BM account being suspended. Add such code at your own risk.
