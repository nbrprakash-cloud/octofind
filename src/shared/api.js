/**
 * @file        api.js
 * @description Octofinder API client — handles communication with the
 *              Supabase backend for false-positive reports and feedback.
 *
 *              Replace SUPABASE_URL and SUPABASE_ANON_KEY with your
 *              actual Supabase project values.
 *
 * @module      PromoHighlighter.API
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.API = (() => {

    /* ====================================================================== */
    /*  Config — replace these with your Supabase project values             */
    /* ====================================================================== */

    const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
    const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

    const HEADERS = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
    };

    /* ====================================================================== */
    /*  Rate-limit guard (client-side, per session)                          */
    /* ====================================================================== */

    /** Track submission timestamps to avoid spamming */
    const _submitted = { reports: [], feedback: [] };

    /**
     * Returns true if the user is within the session rate limit.
     * @param {'reports'|'feedback'} kind
     * @param {number} limitPerHour
     */
    function _rateLimitOk(kind, limitPerHour) {
        const now = Date.now();
        const hourAgo = now - 3_600_000;

        // Prune old entries
        _submitted[kind] = _submitted[kind].filter(t => t > hourAgo);

        if (_submitted[kind].length >= limitPerHour) return false;
        _submitted[kind].push(now);
        return true;
    }

    /* ====================================================================== */
    /*  Public methods                                                        */
    /* ====================================================================== */

    /**
     * submitReport
     * ----------------------------------------------------------------
     * Submits a false-positive report to the `reports` table.
     *
     * @param {Object} data
     * @param {string} data.flagged_text  — Text that was incorrectly flagged
     * @param {string} data.username      — Reddit username flagged (or null)
     * @param {string} data.severity      — 'red' | 'yellow'
     * @param {string[]} data.reasons     — Detection reason strings
     * @param {string} data.page_url      — Current Reddit thread URL
     * @param {string} data.extension_version — From manifest
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async function submitReport(data) {
        if (!_rateLimitOk('reports', 5)) {
            return { ok: false, error: 'rate_limit' };
        }

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    flagged_text: data.flagged_text || null,
                    username: data.username || null,
                    severity: data.severity || 'yellow',
                    reasons: data.reasons || [],
                    page_url: data.page_url || null,
                    extension_version: data.extension_version || null,
                    status: 'pending',
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                return { ok: false, error: text };
            }
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    /**
     * submitFeedback
     * ----------------------------------------------------------------
     * Submits a user rating/comment to the `feedback` table.
     *
     * @param {Object} data
     * @param {number} data.rating           — 1–5 star rating
     * @param {string} [data.comment]        — Optional free-text comment
     * @param {string} [data.extension_version]
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async function submitFeedback(data) {
        if (!_rateLimitOk('feedback', 1)) {
            return { ok: false, error: 'rate_limit' };
        }

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    rating: data.rating || null,
                    comment: data.comment || null,
                    extension_version: data.extension_version || null,
                }),
            });

            if (!res.ok) {
                const text = await res.text();
                return { ok: false, error: text };
            }
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }

    /**
     * getStats
     * ----------------------------------------------------------------
     * Fetches public aggregate report stats for the landing page.
     *
     * @returns {Promise<{total_reports: number, error?: string}>}
     */
    async function getStats() {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/reports?select=count&status=eq.accepted`,
                { headers: HEADERS }
            );
            if (!res.ok) return { total_reports: 0, error: 'fetch_failed' };
            const data = await res.json();
            return { total_reports: data?.[0]?.count ?? 0 };
        } catch {
            return { total_reports: 0, error: 'network' };
        }
    }

    return Object.freeze({ submitReport, submitFeedback, getStats });
})();
