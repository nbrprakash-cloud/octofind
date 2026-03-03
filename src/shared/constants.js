/**
 * @file        constants.js
 * @description Global namespace, scoring configuration, Reddit DOM selectors,
 *              and CSS class constants. This is the single source of truth for
 *              all tunable parameters — change weights/thresholds here.
 * @module      PromoHighlighter.Constants
 * @version     0.1.0
 */

/* -------------------------------------------------------------------------- */
/*  Global Namespace                                                          */
/* -------------------------------------------------------------------------- */

/**
 * All content-script modules attach to this namespace so they can
 * communicate without ES-module imports (MV3 content scripts share
 * the same isolated-world global scope when listed in manifest.json).
 */
window.PromoHighlighter = window.PromoHighlighter || {};

/* -------------------------------------------------------------------------- */
/*  Scoring Configuration                                                     */
/* -------------------------------------------------------------------------- */

/**
 * SCORING_CONFIG
 * ------------------------------------------------------------------
 * Weights are added for every match a detector finds.
 * Thresholds decide the severity bucket.
 *
 * To tune sensitivity:
 *   • Raise `red` threshold  → fewer red highlights
 *   • Lower `yellow` threshold → more yellow highlights
 *   • Change individual weights to prioritise certain signals
 *
 * Future: Expose these in the options page for user-level tuning.
 */
window.PromoHighlighter.SCORING_CONFIG = Object.freeze({
    weights: {
        keywordMatch: 2,   // Points per keyword found in comment text
        domainToken: 3,   // Points per domain-like token (e.g. cooltool.ai)
        promoPhrase: 1,   // Points per promo-language pattern match
    },
    thresholds: {
        red: 4,  // totalScore >= 4 → high-likelihood promo (red)
        yellow: 2,  // totalScore >= 2 → medium-likelihood promo (yellow)
    },
});

/* -------------------------------------------------------------------------- */
/*  Reddit DOM Selectors                                                      */
/* -------------------------------------------------------------------------- */

/**
 * SELECTORS
 * ------------------------------------------------------------------
 * CSS selectors targeting New Reddit's DOM structure.
 * If Reddit changes class names, update ONLY here.
 *
 * CRITICAL: commentBody selectors are scoped to comment containers
 * only — they must NEVER match the post title/body area.
 * Using bare ".md" would match every markdown block on the page
 * (including post titles), causing highlight bars in layout areas.
 *
 * • commentContainer — the root that wraps all comment trees
 * • commentBody      — individual comment text body (comments only)
 * • skippedTags      — elements whose inner text we must never highlight
 */
window.PromoHighlighter.SELECTORS = Object.freeze({
    commentContainer: '[id^="comment-tree"],' +
        'shreddit-comment-tree,' +
        '.Comment,' +
        '[data-testid="comment"]',

    /**
     * Comment body selectors — strictly scoped to comment elements.
     *
     * shreddit-comment .md                              → Shreddit redesign
     * .Comment .RichTextJSON-root                       → Legacy new Reddit
     * [data-testid="comment"] [data-testid="comment-body"] → test-id path
     */
    commentBody: 'shreddit-comment .md,' +
        '.Comment .RichTextJSON-root,' +
        '[data-testid="comment"] [data-testid="comment-body"]',

    /** Tags whose children we never walk into when highlighting */
    skippedTags: ['CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'],
});

/* -------------------------------------------------------------------------- */
/*  CSS Class Names                                                           */
/* -------------------------------------------------------------------------- */

/**
 * CSS_CLASSES
 * ------------------------------------------------------------------
 * All injected DOM elements use these classes.  Prefixed `promo-hl-`
 * to avoid collisions with Reddit's own styles.
 */
window.PromoHighlighter.CSS_CLASSES = Object.freeze({
    highlightRed: 'promo-hl-red',
    highlightYellow: 'promo-hl-yellow',
    tooltip: 'promo-hl-tooltip',
    processed: 'promo-hl-processed',   // Marker on scanned comment nodes
});
