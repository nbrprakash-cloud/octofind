/**
 * @file        scoring-engine.js
 * @description Aggregates all registered detectors and produces a final
 *              severity verdict for a given comment text.  Designed as a
 *              pluggable pipeline — add a new detector by pushing it onto
 *              the `detectors` array.
 * @module      PromoHighlighter.ScoringEngine
 * @version     0.1.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.ScoringEngine = (() => {
    const { SCORING_CONFIG, KeywordDetector, DomainDetector, PromoPhraseDetector } = window.PromoHighlighter;

    /* ====================================================================== */
    /*  Detector Registry                                                     */
    /* ====================================================================== */

    /**
     * detectors
     * ----------------------------------------------------------------
     * Array of detector objects.  Each must expose a `detect` method:
     *
     *   detect(text, ...args) → { score, reasons, matches }
     *
     * To add a future detector (e.g. promo-phrase):
     *   1. Create src/content/detectors/promo-phrase-detector.js
     *   2. Add it to manifest.json's content_scripts.js array
     *   3. Push it here:  detectors.push({ name: '...', run: ... })
     *
     * That's it — no other file needs changing.
     */
    const detectors = [
        {
            name: 'keyword',
            /**
             * @param {string}   text     — Comment plain text
             * @param {string[]} keywords — User's keyword list
             */
            run: (text, keywords) => KeywordDetector.detect(text, keywords),
        },
        {
            name: 'domain',
            /**
             * @param {string} text — Comment plain text
             */
            run: (text) => DomainDetector.detect(text),
        },
        // ─── Promo Language Detector ─────────────────────────────────────
        {
            name: 'promoPhrase',
            /**
             * @param {string} text — Comment plain text
             */
            run: (text) => PromoPhraseDetector.detect(text),
        },
    ];

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    /**
     * analyzeText
     * ----------------------------------------------------------------
     * Runs every registered detector on the text, merges their scores
     * and match data, then determines the final severity.
     *
     * @param {string}   text     — Plain text content of a comment.
     * @param {string[]} keywords — Current keyword list from settings.
     * @returns {{
     *   totalScore: number,
     *   severity:   'red' | 'yellow' | null,
     *   reasons:    string[],
     *   matches:    Array<{term: string, index: number, length: number}>
     * }}
     */
    function analyzeText(text, keywords) {
        let totalScore = 0;
        const allReasons = [];
        const allMatches = [];

        // Run each detector and merge results
        for (const detector of detectors) {
            const result = detector.run(text, keywords);
            totalScore += result.score;
            allReasons.push(...result.reasons);
            allMatches.push(...result.matches);
        }

        // Determine severity bracket
        let severity = null;
        if (totalScore >= SCORING_CONFIG.thresholds.red) {
            severity = 'red';
        } else if (totalScore >= SCORING_CONFIG.thresholds.yellow) {
            severity = 'yellow';
        }

        return {
            totalScore,
            severity,
            reasons: allReasons,
            matches: allMatches,
        };
    }

    /* ====================================================================== */
    /*  Expose                                                                */
    /* ====================================================================== */

    return Object.freeze({ analyzeText });
})();
