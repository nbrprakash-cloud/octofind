/**
 * @file        tooltip.js
 * @description Creates and manages a single shared tooltip element that
 *              displays promo-detection reasons when the user hovers over
 *              a highlighted <mark>.  Uses event delegation on the document
 *              body so it works with dynamically injected highlights.
 * @module      PromoHighlighter.Tooltip
 * @version     0.1.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.Tooltip = (() => {
    const { CSS_CLASSES } = window.PromoHighlighter;

    /** Reference to the singleton tooltip element. */
    let tooltipEl = null;

    /** Is the tooltip system initialized? */
    let initialized = false;

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
     * Shows the tooltip with the given reasons and severity.
     *
     * @param {string[]} reasons  — Array of reason strings.
     * @param {string}   severity — 'red' or 'yellow'.
     * @param {MouseEvent} e      — The triggering mouse event.
     */
    function showTooltip(reasons, severity, e) {
        if (!tooltipEl) return;

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

        // Position and show
        tooltipEl.classList.add('promo-hl-tooltip-visible');
        tooltipEl.setAttribute('aria-hidden', 'false');
        positionTooltip(e);
    }

    /**
     * Hides the tooltip.
     */
    function hideTooltip() {
        if (!tooltipEl) return;
        tooltipEl.classList.remove('promo-hl-tooltip-visible');
        tooltipEl.setAttribute('aria-hidden', 'true');
    }

    /* ====================================================================== */
    /*  Event Handlers (delegated)                                            */
    /* ====================================================================== */

    /**
     * Handles mouseenter on highlight marks via event delegation.
     * @param {MouseEvent} e
     */
    function handleMouseOver(e) {
        const mark = e.target.closest(
            `promo-hl.${CSS_CLASSES.highlightRed}, promo-hl.${CSS_CLASSES.highlightYellow}`
        );
        if (!mark) return;

        // Read reasons from data attribute
        let reasons;
        try {
            reasons = JSON.parse(mark.dataset.promoReasons || '[]');
        } catch {
            reasons = ['Promotional mention detected'];
        }

        const severity = mark.dataset.promoSeverity || 'yellow';
        showTooltip(reasons, severity, e);
    }

    /**
     * Handles mouseleave — hides tooltip when cursor leaves a mark.
     * @param {MouseEvent} e
     */
    function handleMouseOut(e) {
        const mark = e.target.closest(
            `promo-hl.${CSS_CLASSES.highlightRed}, promo-hl.${CSS_CLASSES.highlightYellow}`
        );
        if (!mark) return;

        // Only hide if we're actually leaving the mark
        const related = e.relatedTarget;
        if (related && mark.contains(related)) return;

        hideTooltip();
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
        initialized = false;
    }

    /* ====================================================================== */
    /*  Expose                                                                */
    /* ====================================================================== */

    return Object.freeze({ init, destroy });
})();
