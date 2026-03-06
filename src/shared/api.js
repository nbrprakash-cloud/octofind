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

    const SUPABASE_URL = 'https://iheglfcxoprdpggbrbji.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloZWdsZmN4b3ByZHBnZ2JyYmppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MzAxMzgsImV4cCI6MjA4ODMwNjEzOH0.H03ygPkmit2Kkt8k-PN65zyPaQIpSWXqekGxZJxRCfs';

    const HEADERS = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
    };

    const LIMITS = Object.freeze({
        reportText: 280,
        username: 32,
        reasonsCount: 8,
        reasonChars: 140,
        pageUrl: 300,
        feedbackComment: 800,
        reviewName: 80,
        reviewComment: 1000,
        version: 24,
    });

    /* ====================================================================== */
    /*  Rate-limit guard (client-side, per session)                          */
    /* ====================================================================== */

    /** Track submission timestamps to avoid spamming */
    const _submitted = { reports: [], feedback: [], reviews: [] };

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

    function _cleanText(value, maxLen) {
        if (typeof value !== 'string') return null;
        const compact = value.replace(/\s+/g, ' ').trim();
        if (!compact) return null;
        return compact.substring(0, maxLen);
    }

    function _sanitizeVersion(value) {
        const raw = _cleanText(value, LIMITS.version);
        if (!raw) return null;
        return /^\d+\.\d+\.\d+$/.test(raw) ? raw : null;
    }

    function _currentVersion(fallback = null) {
        try {
            const runtimeVersion = chrome.runtime.getManifest?.()?.version || null;
            return _sanitizeVersion(runtimeVersion || fallback);
        } catch {
            return _sanitizeVersion(fallback);
        }
    }

    function _sanitizeUsername(value) {
        const raw = _cleanText(value, LIMITS.username);
        if (!raw) return null;
        return /^[A-Za-z0-9_-]{1,32}$/.test(raw) ? raw : null;
    }

    function _sanitizeSeverity(value) {
        return value === 'red' ? 'red' : 'yellow';
    }

    function _sanitizeReasons(reasons) {
        if (!Array.isArray(reasons)) return [];
        const seen = new Set();
        const cleaned = [];

        for (const item of reasons) {
            const reason = _cleanText(item, LIMITS.reasonChars);
            if (!reason) continue;
            const key = reason.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            cleaned.push(reason);
            if (cleaned.length >= LIMITS.reasonsCount) break;
        }

        return cleaned;
    }

    function _sanitizePageUrl(rawUrl) {
        if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;

        try {
            const url = new URL(rawUrl);
            const host = url.hostname.toLowerCase();
            if (!/^([a-z0-9-]+\.)?reddit\.com$/.test(host)) return null;
            return `${url.origin}${url.pathname}`.substring(0, LIMITS.pageUrl);
        } catch {
            return null;
        }
    }

    function _sanitizeReportText(rawText) {
        let text = _cleanText(rawText, LIMITS.reportText * 2);
        if (!text) return null;

        // Remove high-sensitivity material before telemetry leaves the browser.
        text = text
            .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
            .replace(/\bhttps?:\/\/\S+/gi, '[url]')
            .replace(/\b(token|api[_-]?key|secret|session|auth|code)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
            .replace(/\b[A-Za-z0-9_\-]{24,}\b/g, '[token]')
            .trim();

        if (text.length < 3) return null;
        return text.substring(0, LIMITS.reportText);
    }

    async function _readApiError(res) {
        const text = (await res.text()).trim();
        if (/rate_limit/i.test(text)) return 'rate_limit';
        if (/violates row-level security policy|new row violates check constraint/i.test(text)) {
            return 'validation_failed';
        }
        return text || 'request_failed';
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

        const payload = {
            flagged_text: _sanitizeReportText(data?.flagged_text),
            username: _sanitizeUsername(data?.username),
            severity: _sanitizeSeverity(data?.severity),
            reasons: _sanitizeReasons(data?.reasons),
            page_url: _sanitizePageUrl(data?.page_url),
            extension_version: _currentVersion(data?.extension_version),
            status: 'pending',
        };

        if (!payload.extension_version) {
            return { ok: false, error: 'invalid_extension_version' };
        }

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                return { ok: false, error: await _readApiError(res) };
            }
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err?.message || 'network' };
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

        const rating = Number(data?.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return { ok: false, error: 'invalid_rating' };
        }

        const payload = {
            rating,
            comment: _cleanText(data?.comment, LIMITS.feedbackComment),
            extension_version: _currentVersion(data?.extension_version),
        };

        if (!payload.extension_version) {
            return { ok: false, error: 'invalid_extension_version' };
        }

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                return { ok: false, error: await _readApiError(res) };
            }
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err?.message || 'network' };
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

    /**
     * submitReview
     * ----------------------------------------------------------------
     * Submits a public review to the `reviews` table.
     * Reviews are held for admin approval before showing publicly.
     *
     * @param {Object} data
     * @param {string} data.name             — Display name
     * @param {string} [data.reddit_username] — Optional u/handle
     * @param {number} data.rating           — 1–5 stars
     * @param {string} data.comment          — Review text
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    async function submitReview(data) {
        if (!data.name || !data.comment || !data.rating) {
            return { ok: false, error: 'missing_fields' };
        }
        if (!_rateLimitOk('reviews', 1)) {
            return { ok: false, error: 'rate_limit' };
        }

        const rating = Number(data.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return { ok: false, error: 'invalid_rating' };
        }

        const name = _cleanText(data.name, LIMITS.reviewName);
        const comment = _cleanText(data.comment, LIMITS.reviewComment);
        const redditUsername = _sanitizeUsername((data.reddit_username || '').replace(/^u\//i, ''));

        if (!name || !comment || comment.length < 10) {
            return { ok: false, error: 'invalid_fields' };
        }

        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    name,
                    reddit_username: redditUsername,
                    rating,
                    comment,
                    approved: false,
                }),
            });

            if (!res.ok) {
                return { ok: false, error: await _readApiError(res) };
            }
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err?.message || 'network' };
        }
    }

    /**
     * getApprovedReviews
     * ----------------------------------------------------------------
     * Fetches all approved reviews for display on the reviews page.
     * Only returns reviews where approved = true (enforced by RLS).
     *
     * @param {number} [limit=50] — Max number of reviews to fetch
     * @returns {Promise<{reviews: Array, error?: string}>}
     */
    async function getApprovedReviews(limit = 50) {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/reviews?approved=eq.true&order=created_at.desc&limit=${limit}`,
                { headers: { ...HEADERS, 'Prefer': 'return=representation' } }
            );
            if (!res.ok) return { reviews: [], error: 'fetch_failed' };
            const data = await res.json();
            return { reviews: data ?? [] };
        } catch {
            return { reviews: [], error: 'network' };
        }
    }

    return Object.freeze({ submitReport, submitFeedback, getStats, submitReview, getApprovedReviews });
})();
