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

    /* ====================================================================== */
    /*  Hide State                                                            */
    /* ====================================================================== */

    /** Linger timer — hides after 1s when mouse leaves target */
    let lingerTimer = null;

    /** Pin timer — hides after 3s when user clicked the highlight */
    let pinTimer = null;
    let pinAnimFrame = null;
    let pinStart = null;

    /** Whether tooltip is currently pinned (click mode) */
    let isPinned = false;

    /** Whether mouse is inside the tooltip box */
    let overTooltip = false;

    /** Progress bar element inside tooltip when pinned */
    let progressEl = null;

    function clearLingerTimer() {
        if (lingerTimer) { clearTimeout(lingerTimer); lingerTimer = null; }
    }

    function clearPinTimer() {
        if (pinTimer) { clearTimeout(pinTimer); pinTimer = null; }
        if (pinAnimFrame) { cancelAnimationFrame(pinAnimFrame); pinAnimFrame = null; }
        pinStart = null;
    }

    /**
     * Immediately hides tooltip and resets all state.
     */
    function hideTooltip() {
        clearLingerTimer();
        clearPinTimer();
        isPinned = false;
        overTooltip = false;
        if (!tooltipEl) return;
        tooltipEl.classList.remove('promo-hl-tooltip-visible', 'promo-hl-pinned');
        tooltipEl.setAttribute('aria-hidden', 'true');
        if (progressEl) { progressEl.remove(); progressEl = null; }
        currentMark = null;
    }

    /**
     * Start 1-second linger before hiding.
     * Cancelled if mouse re-enters trigger or tooltip.
     */
    function scheduleLinger() {
        clearLingerTimer();
        lingerTimer = setTimeout(() => {
            // Only hide if not pinned and not over tooltip
            if (!isPinned && !overTooltip) {
                hideTooltip();
            }
        }, 1000);
    }

    /**
     * Pin the tooltip for 3 seconds with an animated progress bar.
     * Called when the user clicks a trigger element.
     */
    function pinTooltip() {
        clearLingerTimer();
        clearPinTimer();
        isPinned = true;
        tooltipEl.classList.add('promo-hl-pinned');

        // Create/reset progress bar
        if (progressEl) progressEl.remove();
        progressEl = document.createElement('div');
        progressEl.className = 'promo-hl-pin-progress';
        tooltipEl.appendChild(progressEl);

        const DURATION = 3000;
        pinStart = performance.now();

        function tick(now) {
            const elapsed = now - pinStart;
            const pct = Math.min(elapsed / DURATION, 1);
            if (progressEl) progressEl.style.width = `${(1 - pct) * 100}%`;

            if (pct < 1) {
                pinAnimFrame = requestAnimationFrame(tick);
            } else {
                // Time's up
                isPinned = false;
                tooltipEl.classList.remove('promo-hl-pinned');
                if (progressEl) { progressEl.remove(); progressEl = null; }
                if (!overTooltip) hideTooltip();
            }
        }
        pinAnimFrame = requestAnimationFrame(tick);
    }

    /* ====================================================================== */
    /*  Event Handlers (delegated)                                            */
    /* ====================================================================== */

    /**
     * Mouse enters a trigger — show tooltip, cancel any pending hide.
     */
    function handleMouseOver(e) {
        const mark = e.target.closest(TRIGGER_SELECTOR);
        if (!mark) return;

        clearLingerTimer();

        if (currentMark === mark) {
            // Already showing — just reposition
            positionTooltip(e);
            return;
        }

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
     * Mouse leaves a trigger — start 1s linger before hiding.
     */
    function handleMouseOut(e) {
        const mark = e.target.closest(TRIGGER_SELECTOR);
        if (!mark) return;

        const related = e.relatedTarget;
        if (related && mark.contains(related)) return;
        // Moved to tooltip — stay open
        if (related && tooltipEl && tooltipEl.contains(related)) return;

        if (!isPinned) scheduleLinger();
    }

    /**
     * Click on a trigger — pin tooltip for 3 seconds.
     */
    function handleTriggerClick(e) {
        const mark = e.target.closest(TRIGGER_SELECTOR);
        if (!mark) return;

        // Ensure tooltip is visible
        if (currentMark !== mark) {
            let reasons;
            try { reasons = JSON.parse(mark.dataset.promoReasons || '[]'); }
            catch { reasons = ['Promotional mention detected']; }
            showTooltip(reasons, mark.dataset.promoSeverity || 'yellow', e, mark);
        }
        pinTooltip();
    }

    /**
     * Click outside — dismiss immediately (unless it's the report link).
     */
    function handleClickOutside(e) {
        if (!tooltipEl) return;
        if (tooltipEl.contains(e.target)) return;
        if (e.target.closest && e.target.closest(TRIGGER_SELECTOR)) return;
        hideTooltip();
    }

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    /**
     * init
     */
    function init() {
        if (initialized) return;

        createTooltipElement();

        document.body.addEventListener('mouseover', handleMouseOver, true);
        document.body.addEventListener('mouseout', handleMouseOut, true);
        document.body.addEventListener('click', handleTriggerClick, true);
        document.addEventListener('click', handleClickOutside, true);

        // Tooltip hover — keep alive indefinitely while inside
        document.body.addEventListener('mouseover', (e) => {
            if (tooltipEl && tooltipEl.contains(e.target)) {
                overTooltip = true;
                clearLingerTimer();
            }
        }, true);

        document.body.addEventListener('mouseout', (e) => {
            if (tooltipEl && tooltipEl.contains(e.target)) {
                const related = e.relatedTarget;
                if (related && tooltipEl.contains(related)) return;
                if (related && related.closest && related.closest(TRIGGER_SELECTOR)) {
                    overTooltip = false;
                    return;
                }
                overTooltip = false;
                if (!isPinned) scheduleLinger();
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
