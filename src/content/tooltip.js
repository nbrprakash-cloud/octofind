/**
 * @file        tooltip.js
 * @description Creates and manages a single shared tooltip element that
 *              displays promo-detection reasons when the user hovers over
 *              a highlighted <promo-hl>.  Uses event delegation on the
 *              document body so it works with dynamically injected highlights.
 *
 *              Includes a "False positive?" link that opens a pre-filled
 *              GitHub Issue with the flagged text, severity, and page URL.
 *
 * @module      PromoHighlighter.Tooltip
 * @version     0.2.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.Tooltip = (() => {
    const { CSS_CLASSES } = window.PromoHighlighter;

    /* ====================================================================== */
    /*  Config                                                                */
    /* ====================================================================== */

    /**
     * GITHUB_REPO — the GitHub repository where false-positive reports
     * are filed as Issues.  Update this to your actual repo URL.
     */
    const GITHUB_REPO = 'https://github.com/tejasns2408-jpg/octofinder';

    /** Reference to the singleton tooltip element. */
    let tooltipEl = null;

    /** Is the tooltip system initialized? */
    let initialized = false;

    /** Currently hovered highlight element — used to build report URL. */
    let currentMark = null;

    /** Timer ID for delayed tooltip hide (3-second linger). */
    let hideTimer = null;

    /** Selectors for all tooltip-triggering elements. */
    const TRIGGER_SELECTOR = [
        `promo-hl.${CSS_CLASSES.highlightRed}`,
        `promo-hl.${CSS_CLASSES.highlightYellow}`,
        `.${CSS_CLASSES.usernameBadge}`,
    ].join(', ');

    /* ====================================================================== */
    /*  Private helpers                                                       */
    /* ====================================================================== */

    /**
     * Creates the tooltip DOM element and appends it to <body>.
     * Called once on first init.
     */
    function createTooltipElement() {
        tooltipEl = document.createElement('div');
        tooltipEl.className = CSS_CLASSES.tooltip;
        tooltipEl.setAttribute('role', 'tooltip');
        tooltipEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(tooltipEl);
    }

    /**
     * Positions the tooltip near the mouse cursor, ensuring it doesn't
     * overflow the viewport edges.
     *
     * @param {MouseEvent} e — The mousemove / mouseenter event.
     */
    function positionTooltip(e) {
        if (!tooltipEl) return;

        const OFFSET_X = 12;
        const OFFSET_Y = 16;
        const PADDING = 8; // Minimum gap from viewport edge

        let x = e.clientX + OFFSET_X;
        let y = e.clientY + OFFSET_Y;

        // Ensure tooltip stays within viewport bounds
        const rect = tooltipEl.getBoundingClientRect();
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;

        // Flip left if overflowing right
        if (x + rect.width + PADDING > viewW) {
            x = e.clientX - rect.width - OFFSET_X;
        }

        // Flip up if overflowing bottom
        if (y + rect.height + PADDING > viewH) {
            y = e.clientY - rect.height - OFFSET_Y;
        }

        // Clamp to viewport
        x = Math.max(PADDING, x);
        y = Math.max(PADDING, y);

        tooltipEl.style.left = `${x}px`;
        tooltipEl.style.top = `${y}px`;
    }

    /**
     * buildReportUrl
     * ----------------------------------------------------------------
     * Constructs a pre-filled GitHub Issue URL with diagnostic info
     * so the user doesn't need to describe anything manually.
     *
     * @param {string}   flaggedText — The text that was highlighted.
     * @param {string}   severity    — 'red' or 'yellow'.
     * @param {string[]} reasons     — Detection reasons.
     * @returns {string} Full GitHub Issue URL.
     */
    function buildReportUrl(flaggedText, severity, reasons) {
        const truncated = flaggedText.length > 80
            ? flaggedText.substring(0, 80) + '…'
            : flaggedText;

        const title = `[False Positive] "${truncated}"`;

        const body = [
            '## False Positive Report',
            '',
            `**Flagged text:** \`${flaggedText}\``,
            `**Severity:** ${severity}`,
            `**Reasons:** ${reasons.join(', ')}`,
            `**Page URL:** ${location.href}`,
            '',
            '### Why is this a false positive?',
            '<!-- Please briefly explain why this mention is not promotional -->',
            '',
        ].join('\n');

        const params = new URLSearchParams({
            title,
            body,
            labels: 'false-positive',
        });

        return `${GITHUB_REPO}/issues/new?${params.toString()}`;
    }

    /**
     * Shows the tooltip with the given reasons, severity, and a
     * "False positive?" report link.
     *
     * @param {string[]}    reasons  — Array of reason strings.
     * @param {string}      severity — 'red' or 'yellow'.
     * @param {MouseEvent}  e        — The triggering mouse event.
     * @param {HTMLElement}  mark    — The highlighted element.
     */
    function showTooltip(reasons, severity, e, mark) {
        if (!tooltipEl) return;

        currentMark = mark;

        // Build tooltip content
        const severityLabel = severity === 'red'
            ? '🔴 High likelihood'
            : '🟡 Medium likelihood';

        tooltipEl.innerHTML = '';

        // Severity header
        const header = document.createElement('div');
        header.className = 'promo-hl-tooltip-header';
        header.textContent = severityLabel;
        tooltipEl.appendChild(header);

        // Reasons list
        const list = document.createElement('ul');
        list.className = 'promo-hl-tooltip-reasons';
        reasons.forEach((reason) => {
            const li = document.createElement('li');
            li.textContent = reason;
            list.appendChild(li);
        });
        tooltipEl.appendChild(list);

        // ── False Positive Report Link ────────────────────────────────
        const reportUrl = buildReportUrl(mark.textContent, severity, reasons);
        const footer = document.createElement('div');
        footer.className = 'promo-hl-tooltip-footer';

        const reportLink = document.createElement('a');
        reportLink.href = reportUrl;
        reportLink.target = '_blank';
        reportLink.rel = 'noopener noreferrer';
        reportLink.className = 'promo-hl-report-link';
        reportLink.textContent = '⚑ False positive? Report it';
        // Prevent tooltip from hiding when clicking the link
        reportLink.addEventListener('mousedown', (ev) => ev.stopPropagation());

        footer.appendChild(reportLink);
        tooltipEl.appendChild(footer);

        // Position and show
        tooltipEl.classList.add('promo-hl-tooltip-visible');
        tooltipEl.setAttribute('aria-hidden', 'false');
        positionTooltip(e);
    }

    /**
     * Hides the tooltip after a delay (default 3 seconds).
     * Allows time for the user to move their cursor to the
     * tooltip and click the report link.
     *
     * @param {number} [delay=3000] — Milliseconds before hiding.
     */
    function scheduleHide(delay = 3000) {
        cancelHide();
        hideTimer = setTimeout(() => {
            if (!tooltipEl) return;
            tooltipEl.classList.remove('promo-hl-tooltip-visible');
            tooltipEl.setAttribute('aria-hidden', 'true');
            currentMark = null;
        }, delay);
    }

    /**
     * Cancels any pending hide timer (e.g. when re-entering
     * the tooltip or trigger element).
     */
    function cancelHide() {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    }

    /**
     * Immediately hides the tooltip (no delay).
     */
    function hideTooltip() {
        cancelHide();
        if (!tooltipEl) return;
        tooltipEl.classList.remove('promo-hl-tooltip-visible');
        tooltipEl.setAttribute('aria-hidden', 'true');
        currentMark = null;
    }

    /* ====================================================================== */
    /*  Event Handlers (delegated)                                            */
    /* ====================================================================== */

    /**
     * Handles mouseenter on highlight marks and username badges
     * via event delegation.
     * @param {MouseEvent} e
     */
    function handleMouseOver(e) {
        // Check for highlight marks
        let mark = e.target.closest(TRIGGER_SELECTOR);
        if (!mark) return;

        // Cancel any pending hide from a previous hover
        cancelHide();

        // Read reasons from data attribute
        let reasons;
        try {
            reasons = JSON.parse(mark.dataset.promoReasons || '[]');
        } catch {
            reasons = ['Promotional mention detected'];
        }

        const severity = mark.dataset.promoSeverity || 'yellow';
        showTooltip(reasons, severity, e, mark);
    }

    /**
     * Handles mouseleave — starts 3-second linger timer instead
     * of hiding immediately, giving users time to reach the
     * tooltip and click the report link.
     * @param {MouseEvent} e
     */
    function handleMouseOut(e) {
        const mark = e.target.closest(TRIGGER_SELECTOR);
        if (!mark) return;

        // Only start hide timer if we're actually leaving the mark
        const related = e.relatedTarget;
        if (related && mark.contains(related)) return;

        // Don't start timer if the mouse moves to the tooltip itself
        if (related && tooltipEl && tooltipEl.contains(related)) return;

        // Start 3-second linger — tooltip stays visible
        scheduleHide(3000);
    }

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    /**
     * init
     * ----------------------------------------------------------------
     * Initializes the tooltip system.  Creates the tooltip element and
     * attaches delegated event listeners.  Safe to call multiple times
     * (idempotent).
     */
    function init() {
        if (initialized) return;

        createTooltipElement();

        // Delegated listeners on document.body — works for all current
        // and future highlight marks without needing to attach per-element.
        document.body.addEventListener('mouseover', handleMouseOver, true);
        document.body.addEventListener('mouseout', handleMouseOut, true);

        // Keep tooltip alive when hovering over it (cancel hide timer)
        // Hide when leaving the tooltip AND not entering a trigger element
        document.body.addEventListener('mouseover', (e) => {
            if (tooltipEl && tooltipEl.contains(e.target)) {
                // Mouse entered the tooltip — cancel hide
                cancelHide();
                return;
            }
        }, true);

        document.body.addEventListener('mouseout', (e) => {
            if (tooltipEl && tooltipEl.contains(e.target)) {
                const related = e.relatedTarget;
                // Leaving tooltip — only start timer if not going to a trigger
                if (related && tooltipEl.contains(related)) return;
                if (related && related.closest && related.closest(TRIGGER_SELECTOR)) return;
                scheduleHide(3000);
            }
        }, true);

        initialized = true;
    }

    /**
     * destroy
     * ----------------------------------------------------------------
     * Removes the tooltip element and event listeners.  Used when the
     * extension is disabled to clean up completely.
     */
    function destroy() {
        if (!initialized) return;

        document.body.removeEventListener('mouseover', handleMouseOver, true);
        document.body.removeEventListener('mouseout', handleMouseOut, true);

        if (tooltipEl && tooltipEl.parentNode) {
            tooltipEl.parentNode.removeChild(tooltipEl);
        }
        tooltipEl = null;
        currentMark = null;
        initialized = false;
    }

    /* ====================================================================== */
    /*  Expose                                                                */
    /* ====================================================================== */

    return Object.freeze({ init, destroy });
})();
