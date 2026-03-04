/**
 * @file        service-worker.js
 * @description Manifest V3 background service worker.  Handles extension
 *              lifecycle events — specifically, seeding default settings
 *              into chrome.storage.sync on first install.
 * @module      PromoHighlighter.ServiceWorker
 * @version     0.1.0
 */

/* -------------------------------------------------------------------------- */
/*  Default settings (duplicated here because service workers run in a        */
/*  separate context and don't share globals with content scripts)            */
/* -------------------------------------------------------------------------- */

const DEFAULT_KEYWORDS = [
    'Airtable', 'Beehiiv', 'Canva', 'ChatGPT', 'ClickUp', 'Copilot',
    'Cursor', 'Descript', 'Figma', 'Framer', 'Gamma', 'Grammarly',
    'Jasper', 'Jira', 'Lemon Squeezy', 'Linear', 'Loophole', 'Mailchimp',
    'Midjourney', 'Miro', 'Monday', 'Notion', 'Obsidian', 'Otter',
    'Perplexity', 'Pitch', 'Raycast', 'Replika', 'Runway', 'Semrush',
    'ShipFast', 'Slack', 'Stripe', 'Substack', 'Superhuman', 'Surfer SEO',
    'Tally', 'Taskade', 'Todoist', 'Trello', 'Typeform', 'Vercel',
    'Webflow', 'Writesonic', 'Zapier',
];

const DEFAULT_SETTINGS = {
    enabled: true,
    keywords: [...DEFAULT_KEYWORDS],
};

const STORAGE_KEY = 'promoHighlighterSettings';

/* -------------------------------------------------------------------------- */
/*  Lifecycle Events                                                          */
/* -------------------------------------------------------------------------- */

/**
 * onInstalled
 * ------------------------------------------------------------------
 * Fires when the extension is first installed or updated.
 * Seeds default settings if none exist yet (preserves user changes
 * on updates by checking for existing data first).
 */
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        // First install — write full defaults
        await chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
    } else if (details.reason === 'update') {
        // Update — merge new defaults with existing settings so new fields
        // are added without overwriting the user's customisations.
        const result = await chrome.storage.sync.get(STORAGE_KEY);
        const existing = result[STORAGE_KEY] || {};
        const merged = { ...DEFAULT_SETTINGS, ...existing };
        await chrome.storage.sync.set({ [STORAGE_KEY]: merged });
    }
});

/* -------------------------------------------------------------------------- */
/*  Badge Counter                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Listens for messages from the content script to update the badge
 * on the extension icon with the number of promos found on the page.
 */
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'PROMO_COUNT' && sender.tab?.id) {
        const count = message.count || 0;
        const tabId = sender.tab.id;

        if (count > 0) {
            chrome.action.setBadgeText({ text: String(count), tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#dc3545', tabId });
        } else {
            chrome.action.setBadgeText({ text: '', tabId });
        }
    }
});

/**
 * Reset badge when the user navigates to a different page within the tab.
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        chrome.action.setBadgeText({ text: '', tabId });
    }
});

