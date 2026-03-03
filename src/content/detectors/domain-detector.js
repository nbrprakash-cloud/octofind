/**
 * @file        domain-detector.js
 * @description Scans comment text for domain-like tokens (e.g. cooltool.ai,
 *              myapp.io) and returns scored results.  Filters out common
 *              well-known domains to reduce false positives.
 * @module      PromoHighlighter.DomainDetector
 * @version     0.1.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.DomainDetector = (() => {
    const { SCORING_CONFIG } = window.PromoHighlighter;

    /* ====================================================================== */
    /*  Configuration                                                         */
    /* ====================================================================== */

    /**
     * TLDs we care about — these are the extensions most commonly used
     * by SaaS products and indie tools.  We intentionally exclude generic
     * TLDs like .org, .net, .edu to keep noise low.
     */
    const TARGET_TLDS = ['ai', 'io', 'com', 'co', 'app', 'dev', 'tools', 'so'];

    /**
     * The regex matches tokens like "cooltool.ai" or "my-app.io".
     * It requires at least one word character before the dot and one of
     * our target TLDs after.  The negative lookbehind (?<!\/) prevents
     * matching paths like "github.com/user" (the "/user" part).
     *
     * Pattern breakdown:
     *   \b          — word boundary
     *   [\w-]+      — one or more word chars or hyphens (the domain name)
     *   \.          — literal dot
     *   (ai|io|…)   — one of our target TLDs
     *   \b          — word boundary (ensures ".common" doesn't match inside ".community")
     */
    const DOMAIN_REGEX = new RegExp(
        `\\b([\\w-]+\\.(?:${TARGET_TLDS.join('|')}))\\b`,
        'gi'
    );

    /**
     * SAFE_DOMAINS — well-known domains that are virtually never
     * promotional self-links.  These are filtered out to reduce noise.
     * All lowercase for comparison.
     */
    const SAFE_DOMAINS = new Set([
        'reddit.com',
        'google.com',
        'youtube.com',
        'twitter.com',
        'x.com',
        'facebook.com',
        'instagram.com',
        'github.com',
        'gitlab.com',
        'stackoverflow.com',
        'wikipedia.org',
        'amazon.com',
        'apple.com',
        'microsoft.com',
        'linkedin.com',
        'twitch.tv',
        'discord.com',
        'imgur.com',
        'medium.com',
        'tiktok.com',
        'spotify.com',
        'netflix.com',
        'yahoo.com',
        'bing.com',
        'duckduckgo.com',
        'archive.org',
        'nytimes.com',
        'bbc.com',
        'cnn.com',
        'reuters.com',
        'theguardian.com',
        'washingtonpost.com',
        'npmjs.com',
        'pypi.org',
        'docs.google.com',
        'drive.google.com',
        'mail.google.com',
        'i.redd.it',
        'v.redd.it',
        'old.reddit.com',
        'new.reddit.com',
        'en.wikipedia.org',
    ]);

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    /**
     * detect
     * ----------------------------------------------------------------
     * Scans text for domain-like tokens and scores them.
     *
     * @param {string} text — Plain text content of a comment.
     * @returns {{
     *   score:   number,
     *   reasons: string[],
     *   matches: Array<{term: string, index: number, length: number}>
     * }}
     */
    function detect(text) {
        const result = { score: 0, reasons: [], matches: [] };
        const seen = new Set();

        // Reset lastIndex for safety
        DOMAIN_REGEX.lastIndex = 0;

        let match;
        while ((match = DOMAIN_REGEX.exec(text)) !== null) {
            const domain = match[1].toLowerCase();

            // Skip well-known safe domains
            if (SAFE_DOMAINS.has(domain)) continue;

            result.matches.push({
                term: match[1],
                index: match.index,
                length: match[1].length,
            });

            // Score only once per unique domain
            if (!seen.has(domain)) {
                seen.add(domain);
                result.score += SCORING_CONFIG.weights.domainToken;
                result.reasons.push(`Domain: "${match[1]}"`);
            }
        }

        return result;
    }

    /* ====================================================================== */
    /*  Expose                                                                */
    /* ====================================================================== */

    return Object.freeze({ detect });
})();
