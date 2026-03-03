/**
 * @file        promo-language-detector.js
 * @description Detects promotional language patterns in Reddit comment text.
 *              Patterns are derived from the AntiGravity Reddit Promo Dataset
 *              (antigravity_dataset/data/reddit_promo_dataset_clean.csv),
 *              specifically from the `label_rationale` and `comment_excerpt_280`
 *              columns of Label-A (Promo/Shill) entries.
 *
 *              Pattern categories extracted from dataset:
 *                A. Creator self-promotion  ("I made/built/created this")
 *                B. Referral / discount codes
 *                C. Over-enthusiastic praise  ("solid 10/10", "truly transformed")
 *                D. First-person ownership   ("my app", "our product", "we launched")
 *                E. Call to action           ("check it out", "try it free", "sign up")
 *                F. Affiliate / sponsorship  ("sponsored by", "in partnership with")
 *
 * @module      PromoHighlighter.PromoPhraseDetector
 * @version     0.1.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.PromoPhraseDetector = (() => {
    const { SCORING_CONFIG } = window.PromoHighlighter;

    /* ====================================================================== */
    /*  Pattern Library                                                        */
    /* ====================================================================== */

    /**
     * Each entry has:
     *   pattern  — RegExp (case-insensitive, compiled once)
     *   score    — Points added to the total when matched
     *   reason   — Human-readable tooltip reason string
     *   category — Source category (for debugging / future filtering)
     *
     * Scores are intentionally lower than keyword/domain weights because
     * promo phrases alone may appear in neutral discussion.  They combine
     * additively with keyword/domain hits to push the total over thresholds.
     */
    const PATTERNS = [

        // ── A. Creator self-promotion ──────────────────────────────────────
        // Dataset sources:
        //   "yes, I use kickmyass.io everyday because I made it"          → label_rationale: "self-made promo, pushing own product"
        //   "I created Telemore AI... it actively assists users"           → label_rationale: "'we built this' style, creator shill"
        {
            pattern: /\b(i\s+(made|built|created|developed|launched|coded|shipped|wrote)\s+(this|it|my|our|an?)\b)/i,
            score: SCORING_CONFIG.weights.promoPhrase * 2, // High signal
            reason: 'Creator self-promotion detected',
            category: 'A',
        },
        {
            pattern: /\b(we\s+(made|built|created|developed|launched|shipped)\s+(this|it|our|the))\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 2,
            reason: 'Team self-promotion detected',
            category: 'A',
        },
        {
            pattern: /\b(my\s+(app|tool|product|startup|saas|extension|plugin|software|service))\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 2,
            reason: 'Own product mention',
            category: 'A',
        },
        {
            pattern: /\b(our\s+(app|tool|product|startup|saas|extension|plugin|software|service|platform))\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 2,
            reason: 'Own product mention (team)',
            category: 'A',
        },

        // ── B. Referral / discount codes ──────────────────────────────────
        // Dataset source:
        //   "Rize.io has truly transformed my productivity... use my referral code B3E7CB"  → "referral code, explicit promo"
        {
            pattern: /\b(referral\s+code|promo\s+code|discount\s+code|coupon\s+code|use\s+(code|my\s+code))\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 3, // Very high signal — almost never organic
            reason: 'Referral or discount code found',
            category: 'B',
        },
        {
            pattern: /\b(affiliate\s+link|get\s+\d+%\s+off|first\s+month\s+free|free\s+trial\s+link)\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 3,
            reason: 'Affiliate or discount offer',
            category: 'B',
        },

        // ── C. Over-enthusiastic praise ───────────────────────────────────
        // Dataset source:
        //   "Notion: I rely on this platform daily... solid 10/10!"        → "over-enthusiastic rating, promo tone"
        //   "Rize.io has truly transformed my productivity"                → "strong endorsement without comparison"
        {
            pattern: /\b(\d+\s*\/\s*10|ten\s+out\s+of\s+ten)\b/i,
            score: SCORING_CONFIG.weights.promoPhrase,
            reason: 'Numeric rating (promo tone)',
            category: 'C',
        },
        {
            pattern: /\b(truly\s+(transformed|changed|revolutionized|disrupted)|game[\s-]changer|life[\s-]changing|completely\s+changed\s+my)\b/i,
            score: SCORING_CONFIG.weights.promoPhrase,
            reason: 'Hyperbolic product praise',
            category: 'C',
        },
        {
            pattern: /\b(best\s+(tool|app|software|platform|product)\s+i('ve|\s+have)?\s+ever\s+(used|tried|seen))\b/i,
            score: SCORING_CONFIG.weights.promoPhrase,
            reason: 'Superlative product endorsement',
            category: 'C',
        },

        // ── D. Pricing hints / free-plan pitches ──────────────────────────
        // Dataset source:
        //   "Fathom AI: I use this for taking meeting notes; it's a solid choice"  → "pricing hint/free plan pitch in context"
        {
            pattern: /\b(free\s+(plan|tier|forever|version)|freemium|no\s+credit\s+card\s+required|try\s+it\s+for\s+free|start\s+for\s+free)\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 2,
            reason: 'Free plan or pricing pitch',
            category: 'D',
        },

        // ── E. Call-to-action language ────────────────────────────────────
        {
            pattern: /\b(check\s+it\s+out|give\s+it\s+a\s+(try|shot|go)|sign\s+up\s+(now|today|here)|try\s+it\s+(out|today|now|free))\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 2,
            reason: 'Call-to-action phrase',
            category: 'E',
        },
        {
            pattern: /\b(link\s+in\s+(bio|comments?|description)|dm\s+(me|for|if)|lmk\s+if\s+you\s+want)\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 2,
            reason: 'Call-to-action redirect',
            category: 'E',
        },

        // ── F. Sponsorship / disclosure language ──────────────────────────
        {
            pattern: /\b(sponsored\s+by|in\s+partnership\s+with|paid\s+promotion|this\s+is\s+an?\s+ad|not\s+sponsored\s+but)\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 3,
            reason: 'Sponsorship or partnership disclosure',
            category: 'F',
        },

        // ── G. "Just launched" / new product signals ──────────────────────
        {
            pattern: /\b(just\s+launched|we\s+just\s+shipped|newly\s+launched|soft\s+launch|beta\s+(access|users|testers?)|early\s+access)\b/i,
            score: SCORING_CONFIG.weights.promoPhrase * 2,
            reason: 'Product launch announcement',
            category: 'G',
        },
        {
            pattern: /\b(looking\s+for\s+(beta|early)\s+(testers?|users?|feedback)|would\s+love\s+(feedback|your\s+thoughts))\b/i,
            score: SCORING_CONFIG.weights.promoPhrase,
            reason: 'Seeking product feedback (possible shill)',
            category: 'G',
        },

        // ── H. Stack / tool-list style promo ─────────────────────────────
        // Dataset source:
        //   "consider utilizing FirstPromoter or Rewardful"                → "pushing specific tools as solution"
        {
            pattern: /\b(consider\s+(using|utilizing|trying|checking\s+out)|highly\s+recommend\s+(using|trying|checking\s+out)|i\s+recommend\s+(using|trying))\b/i,
            score: SCORING_CONFIG.weights.promoPhrase,
            reason: 'Pushed tool recommendation',
            category: 'H',
        },
    ];

    /* ====================================================================== */
    /*  Private helpers                                                       */
    /* ====================================================================== */

    /**
     * Runs all patterns against the text.
     * Returns matched patterns with their score and reason.
     *
     * @param {string} text — Comment plain text.
     * @returns {Array<{ pattern: RegExp, score: number, reason: string, match: RegExpMatchArray }>}
     */
    function findPatternMatches(text) {
        const hits = [];
        for (const entry of PATTERNS) {
            const match = entry.pattern.exec(text);
            if (match) {
                hits.push({ ...entry, match });
            }
        }
        return hits;
    }

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    /**
     * detect
     * ----------------------------------------------------------------
     * Matches promo-language patterns against the comment text.
     *
     * Conforms to the ScoringEngine detector interface:
     *   detect(text) → { score, reasons, matches }
     *
     * @param {string} text — Comment plain text.
     * @returns {{
     *   score:   number,
     *   reasons: string[],
     *   matches: Array<{term: string, index: number, length: number}>
     * }}
     */
    function detect(text) {
        if (!text) return { score: 0, reasons: [], matches: [] };

        const hits = findPatternMatches(text);
        if (hits.length === 0) return { score: 0, reasons: [], matches: [] };

        // De-duplicate reasons (multiple overlapping patterns may fire)
        const uniqueReasons = [...new Set(hits.map((h) => h.reason))];
        const totalScore = hits.reduce((sum, h) => sum + h.score, 0);

        // Convert regex matches to { term, index, length } for the highlighter
        const matches = hits.map((h) => ({
            term: h.match[0],
            index: h.match.index,
            length: h.match[0].length,
        }));

        return { score: totalScore, reasons: uniqueReasons, matches };
    }

    /* ====================================================================== */
    /*  Expose                                                                */
    /* ====================================================================== */

    return Object.freeze({ detect });
})();
