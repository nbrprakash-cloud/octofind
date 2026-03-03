/**
 * @file        defaults.js
 * @description Default keyword list and settings object. Used to seed
 *              chrome.storage.sync on first install and to power the
 *              "Reset to Defaults" action in the options page.
 * @module      PromoHighlighter.Defaults
 * @version     0.1.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

/* -------------------------------------------------------------------------- */
/*  Default Keywords                                                          */
/* -------------------------------------------------------------------------- */

/**
 * DEFAULT_KEYWORDS
 * ------------------------------------------------------------------
 * A curated list of commonly promoted SaaS tools, apps, and services
 * seen in Reddit self-promotion.  Users can add/remove keywords via
 * the options page; these are the "factory defaults".
 *
 * Matching is case-insensitive and uses word-boundary checks so that
 * "Notion" won't match "emotional" but will match "I use Notion".
 *
 * Sorted alphabetically for easy auditing.
 */
window.PromoHighlighter.DEFAULT_KEYWORDS = Object.freeze([
    'Airtable',
    'Beehiiv',
    'Canva',
    'ChatGPT',
    'ClickUp',
    'Copilot',
    'Cursor',
    'Descript',
    'Figma',
    'Framer',
    'Gamma',
    'Grammarly',
    'Jasper',
    'Jira',
    'Lemon Squeezy',
    'Linear',
    'Loophole',
    'Mailchimp',
    'Midjourney',
    'Miro',
    'Monday',
    'Notion',
    'Obsidian',
    'Otter',
    'Perplexity',
    'Pitch',
    'Raycast',
    'Replika',
    'Runway',
    'Semrush',
    'ShipFast',
    'Slack',
    'Stripe',
    'Substack',
    'Superhuman',
    'Surfer SEO',
    'Tally',
    'Taskade',
    'Todoist',
    'Trello',
    'Typeform',
    'Vercel',
    'Webflow',
    'Writesonic',
    'Zapier',
]);

/* -------------------------------------------------------------------------- */
/*  Default Settings Object                                                   */
/* -------------------------------------------------------------------------- */

/**
 * DEFAULT_SETTINGS
 * ------------------------------------------------------------------
 * The full settings shape stored in chrome.storage.sync.
 * Adding a new field?  Add it here first, then update storage.js and
 * the options page to read/write it.
 */
window.PromoHighlighter.DEFAULT_SETTINGS = Object.freeze({
    /** Master on/off switch */
    enabled: true,

    /** Active keyword list (mutable copy of DEFAULT_KEYWORDS) */
    keywords: [...window.PromoHighlighter.DEFAULT_KEYWORDS],
});
