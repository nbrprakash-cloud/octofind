/**
 * @file        keyword-detector.js
 * @description Scans comment text for matches against the user's keyword
 *              list. Returns scored results with match positions so the
 *              highlighter knows exactly which substrings to wrap.
 * @module      PromoHighlighter.KeywordDetector
 * @version     0.1.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.KeywordDetector = (() => {
    const { SCORING_CONFIG } = window.PromoHighlighter;

    /* ====================================================================== */
    /*  Private helpers                                                       */
    /* ====================================================================== */

    /**
     * Escapes special regex characters in a string so it can be safely
     * embedded inside a RegExp constructor.
     *
     * @param {string} str — Raw string (e.g. "C++")
     * @returns {string} Escaped string safe for new RegExp(...)
     */
    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Builds a single compiled RegExp that matches any keyword in the
     * list using word-boundary assertions.  Case-insensitive.
     *
     * We compile once and reuse — avoids building N regexes per comment.
     *
     * @param {string[]} keywords — Array of keyword strings.
     * @returns {RegExp|null} Compiled regex, or null if list is empty.
     */
    function buildKeywordRegex(keywords) {
        if (!keywords || keywords.length === 0) return null;

        // Sort by length descending so longer phrases match first
        // (e.g. "Surfer SEO" before "SEO").
        const sorted = [...keywords].sort((a, b) => b.length - a.length);
        const pattern = sorted.map(escapeRegex).join('|');

        // \b word boundaries ensure "Notion" won't match inside "emotional"
        return new RegExp(`\\b(${pattern})\\b`, 'gi');
    }

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    /**
     * detect
     * ----------------------------------------------------------------
     * Runs keyword detection on the given text.
     *
     * @param {string}   text     — Plain text content of a comment.
     * @param {string[]} keywords — Current keyword list from settings.
     * @returns {{
     *   score:   number,
     *   reasons: string[],
     *   matches: Array<{term: string, index: number, length: number}>
     * }}
     */
    function detect(text, keywords) {
        const result = { score: 0, reasons: [], matches: [] };
        const regex = buildKeywordRegex(keywords);
        if (!regex) return result;

        let match;
        const seen = new Set(); // Avoid duplicate reasons for the same keyword

        // Reset lastIndex in case the regex object is reused
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            const term = match[0];
            const termLower = term.toLowerCase();

            result.matches.push({
                term,
                index: match.index,
                length: term.length,
            });

            // Score only once per unique keyword, but record all match positions
            if (!seen.has(termLower)) {
                seen.add(termLower);
                result.score += SCORING_CONFIG.weights.keywordMatch;
                result.reasons.push(`Keyword: "${term}"`);
            }
        }

        return result;
    }

    /* ====================================================================== */
    /*  Expose                                                                */
    /* ====================================================================== */

    return Object.freeze({ detect });
})();
