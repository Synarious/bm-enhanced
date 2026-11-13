const configURLs = "__DATA_SOURCES__";

chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'bmus:fetch') return;
    if (!sender.url || new URL(sender.url).origin !== 'https://www.battlemetrics.com') return;

    let url;
    const options = { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10000) };
    switch (message.operation) {
    case 'terms':
        url = configURLs.customConfig;
        break;
    case 'admins':
        url = configURLs.adminList;
        break;
    case 'cbl':
        if (typeof message.steamID !== 'string' || !/^765\d{14}$/.test(message.steamID)) return;
        url = 'https://communitybanlist.com/graphql';
        options.method = 'POST';
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify({
            query: 'query Search($id: String!) { steamUser(id: $id) { riskRating, activeBans: bans(expired: false) { edges { node { id } } }, expiredBans: bans(expired: true) { edges { node { id } } } } }',
            variables: { id: message.steamID }
        });
        break;
    default:
        return;
    }

    fetch(url, options).then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }).then(data => respond({ data }), error => respond({ error: error.message }));
    return true;
});
