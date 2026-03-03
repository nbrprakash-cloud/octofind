/**
 * @file        content.js
 * @description Entry point for the content script.  Orchestrates the full
 *              pipeline: load settings → initial scan → attach MutationObserver
 *              → react to setting changes → handle Reddit SPA navigation.
 *
 *              Scans BOTH comments AND post bodies for promotional mentions.
 *
 *              This is the LAST file loaded (see manifest.json content_scripts
 *              order), so all other modules are guaranteed to be available on
 *              window.PromoHighlighter by the time this executes.
 *
 * @module      PromoHighlighter.ContentScript
 * @version     0.2.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.ContentScript = (() => {
    const {
        CSS_CLASSES,
        SELECTORS,
        Storage,
        ScoringEngine,
        Highlighter,
        Tooltip,
    } = window.PromoHighlighter;

    /* ====================================================================== */
    /*  State                                                                 */
    /* ====================================================================== */

    /** WeakSet of already-processed comment elements — prevents re-scanning. */
    const processedNodes = new WeakSet();

    /** Current settings (refreshed on storage change). */
    let settings = null;

    /** The active MutationObserver instance. */
    let observer = null;

    /** The last known URL — used to detect SPA navigations. */
    let lastUrl = location.href;

    /** Pending nodes from MutationObserver, batched for idle processing. */
    let pendingNodes = new Set();

    /** ID of the scheduled idle callback / timeout. */
    let idleCallbackId = null;

    /* ====================================================================== */
    /*  Scope Guard                                                           */
    /* ====================================================================== */

    /**
     * isInsideScanArea
     * ----------------------------------------------------------------
     * Checks if a node lives inside a scannable area (comment thread
     * OR post body), NOT in the sidebar, header, promoted ads, or nav.
     *
     * @param {Node} node — The node to check.
     * @returns {boolean} True if the node is inside a scannable area.
     */
    function isInsideScanArea(node) {
        const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (!el) return false;

        // Fast check: is this node inside a comment or post?
        if (el.closest('shreddit-comment')) return true;
        if (el.closest('shreddit-post')) return true;
        if (el.closest('.Post')) return true;

        // Fallback: is it inside a known comment container?
        const containers = SELECTORS.commentContainer.split(',');
        for (const selector of containers) {
            try {
                if (el.closest(selector.trim())) return true;
            } catch {
                // Invalid selector — skip
            }
        }

        return false;
    }

    /* ====================================================================== */
    /*  Core Processing                                                       */
    /* ====================================================================== */

    /**
     * processComment
     * ----------------------------------------------------------------
     * Analyzes a single comment/post body element and applies highlights
     * if the scoring result warrants it.
     *
     * Also extracts URLs from hyperlinks (<a> tags) within the element
     * so that domains hidden behind link text (e.g. [click here](url))
     * are still caught by the domain detector.
     *
     * IMPORTANT: This should only be called with elements that have
     * already been filtered through commentBody/postBody selectors.
     *
     * @param {HTMLElement} commentEl — A comment or post body element.
     */
    function processComment(commentEl) {
        // Guard: skip if already processed or extension disabled
        if (processedNodes.has(commentEl)) return;
        if (!settings || !settings.enabled) return;

        // Mark as processed BEFORE analysis to prevent double-processing
        processedNodes.add(commentEl);

        // Extract plain text from the element (textContent strips HTML)
        const text = commentEl.textContent;
        if (!text || text.trim().length < 3) return;

        // ── Extract URLs from hyperlinks ──────────────────────────────
        // When a user writes [tool name](https://tool.com), textContent
        // only sees "tool name". We pull out the href so the domain
        // detector can flag "tool.com".
        const links = commentEl.querySelectorAll('a[href]');
        const hrefs = [];
        links.forEach((a) => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('/') &&
                !href.startsWith('javascript:')) {
                // Extract just the hostname for cleaner detection
                try {
                    const url = new URL(href);
                    hrefs.push(url.hostname);
                } catch {
                    // Not a valid URL — include raw href as-is
                    hrefs.push(href);
                }
            }
        });

        // Append extracted URLs to the text so detectors can see them
        const enrichedText = hrefs.length > 0
            ? text + ' ' + hrefs.join(' ')
            : text;

        // Run through the scoring engine
        const analysis = ScoringEngine.analyzeText(enrichedText, settings.keywords);

        // Only highlight if a severity threshold was crossed
        if (analysis.severity) {
            Highlighter.highlightComment(commentEl, analysis);

            // ── Highlight suspicious links directly ───────────────────
            // The text highlighter wraps text nodes, but link domains live
            // in href attributes. Apply highlight styling directly to <a>
            // tags whose hostname was flagged.
            const sevClass = analysis.severity === 'red'
                ? CSS_CLASSES.highlightRed
                : CSS_CLASSES.highlightYellow;

            links.forEach((a) => {
                const href = a.getAttribute('href');
                if (!href) return;
                try {
                    const hostname = new URL(href).hostname;
                    // Check if this hostname contributed to the score
                    const domainMatched = analysis.matches?.some(
                        (m) => hostname.includes(m.term) || m.term.includes(hostname)
                    );
                    if (domainMatched) {
                        a.classList.add(sevClass);
                        a.dataset.promoSeverity = analysis.severity;
                        a.dataset.promoReasons = JSON.stringify(analysis.reasons);
                        if (analysis.severity === 'red') {
                            a.style.setProperty('background', 'rgba(220,53,69,0.38)', 'important');
                            a.style.setProperty('border-bottom', '2px solid rgba(220,53,69,0.7)', 'important');
                        } else {
                            a.style.setProperty('background', 'rgba(255,193,7,0.40)', 'important');
                            a.style.setProperty('border-bottom', '2px solid rgba(255,193,7,0.7)', 'important');
                        }
                        a.style.setProperty('border-radius', '3px', 'important');
                        a.style.setProperty('padding', '1px 3px', 'important');
                    }
                } catch { /* not a valid URL */ }
            });
        }
    }

    /**
     * findAndProcessContent
     * ----------------------------------------------------------------
     * Queries the DOM for BOTH comment body AND post body elements
     * using SCOPED selectors, and processes any not yet seen.
     *
     * CRITICAL: This is the ONLY function that should initiate
     * processing. The selectors are scoped to known containers
     * so they never match sidebar cards, ads, or nav elements.
     *
     * @param {HTMLElement} [root=document] — Subtree root to search within.
     */
    function findAndProcessContent(root = document) {
        if (!settings || !settings.enabled) return;

        // Combine comment + post selectors
        const allSelectors = [
            ...SELECTORS.commentBody.split(','),
            ...SELECTORS.postBody.split(','),
        ];
        const seen = new Set();

        for (const selector of allSelectors) {
            try {
                const elements = root.querySelectorAll(selector.trim());
                elements.forEach((el) => {
                    if (!seen.has(el)) {
                        seen.add(el);
                        processComment(el);
                    }
                });
            } catch {
                // Invalid selector — ignore and try the next one
            }
        }
    }

    /* ====================================================================== */
    /*  Debounced / Idle Processing                                           */
    /* ====================================================================== */

    /**
     * scheduleBatchProcessing
     * ----------------------------------------------------------------
     * Uses requestIdleCallback (with setTimeout fallback) to process
     * accumulated nodes during the browser's idle periods.
     *
     * KEY DESIGN: We ONLY call findAndProcessContent on added nodes,
     * which applies the scoped commentBody selectors as a gate.
     * We do NOT call processComment directly on the mutation node
     * itself — that would bypass selector scoping and highlight
     * sidebar cards, ads, and post headers.
     */
    function scheduleBatchProcessing() {
        if (idleCallbackId !== null) return; // Already scheduled

        const callback = () => {
            idleCallbackId = null;

            // Snapshot and clear the pending set
            const nodes = [...pendingNodes];
            pendingNodes.clear();

            // Process each added subtree — ONLY through scoped selectors
            for (const node of nodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Use findAndProcessContent which applies scoped
                    // selectors — this ensures we NEVER highlight outside
                    // the comment thread (no sidebar, no ads, no post title)
                    findAndProcessContent(node);
                }
            }
        };

        if (typeof requestIdleCallback === 'function') {
            idleCallbackId = requestIdleCallback(callback, { timeout: 500 });
        } else {
            idleCallbackId = setTimeout(callback, 200);
        }
    }

    /* ====================================================================== */
    /*  MutationObserver                                                      */
    /* ====================================================================== */

    /**
     * onMutation
     * ----------------------------------------------------------------
     * Callback for MutationObserver.  Collects newly added nodes and
     * schedules a batched processing pass.
     *
     * Filters: Only queues element nodes that are inside the comment
     * area (not sidebar, not ads, not header).
     *
     * @param {MutationRecord[]} mutations — Array of mutation records.
     */
    function onMutation(mutations) {
        if (!settings || !settings.enabled) return;

        let hasNewNodes = false;

        for (const mutation of mutations) {
            for (const addedNode of mutation.addedNodes) {
                if (addedNode.nodeType === Node.ELEMENT_NODE) {
                    // Quick filter: skip nodes that are clearly outside
                    // the comment area (sidebar, nav, footer, ads)
                    const tag = addedNode.tagName;
                    if (tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER') continue;

                    pendingNodes.add(addedNode);
                    hasNewNodes = true;
                }
            }
        }

        if (hasNewNodes) {
            scheduleBatchProcessing();
        }
    }

    /**
     * startObserver
     * ----------------------------------------------------------------
     * Attaches the MutationObserver to document.body.
     * Observes childList changes in the entire subtree to catch
     * Reddit's dynamic comment loading and infinite scroll.
     */
    function startObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver(onMutation);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    /**
     * stopObserver
     * ----------------------------------------------------------------
     * Disconnects the MutationObserver and clears pending work.
     */
    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        pendingNodes.clear();
        if (idleCallbackId !== null) {
            if (typeof cancelIdleCallback === 'function') {
                cancelIdleCallback(idleCallbackId);
            } else {
                clearTimeout(idleCallbackId);
            }
            idleCallbackId = null;
        }
    }

    /* ====================================================================== */
    /*  SPA Navigation Detection                                              */
    /* ====================================================================== */

    /**
     * checkUrlChange
     * ----------------------------------------------------------------
     * Reddit is a single-page app — page transitions don't trigger
     * full reloads.  We poll for URL changes and re-scan when detected.
     */
    function checkUrlChange() {
        if (location.href !== lastUrl) {
            lastUrl = location.href;

            // Small delay to let Reddit render the new page content
            setTimeout(() => {
                findAndProcessContent();
            }, 800);
        }
    }

    /**
     * Sets up listeners for SPA navigation:
     *  - popstate (browser back/forward)
     *  - Periodic URL polling (catches pushState navigations)
     */
    function setupNavigationListeners() {
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                lastUrl = location.href;
                findAndProcessContent();
            }, 800);
        });

        setInterval(checkUrlChange, 1500);
    }

    /* ====================================================================== */
    /*  Settings Reactivity                                                   */
    /* ====================================================================== */

    /**
     * handleSettingsChange
     * ----------------------------------------------------------------
     * Called when chrome.storage.sync changes (e.g. user toggled
     * on/off in popup, or edited keywords in options page).
     *
     * @param {Object} newSettings — The updated settings object.
     */
    function handleSettingsChange(newSettings) {
        const wasEnabled = settings?.enabled;
        settings = newSettings;

        if (settings.enabled && !wasEnabled) {
            Tooltip.init();
            findAndProcessContent();
            startObserver();
        } else if (!settings.enabled && wasEnabled) {
            stopObserver();
            Highlighter.removeHighlights();
            Tooltip.destroy();
        } else if (settings.enabled) {
            Highlighter.removeHighlights();
            findAndProcessContent();
        }
    }

    /* ====================================================================== */
    /*  Initialisation                                                        */
    /* ====================================================================== */

    /**
     * init
     * ----------------------------------------------------------------
     * Boots the content script.
     *
     * Flow:
     *   1. Load settings from storage
     *   2. If enabled → init tooltip, scan existing comments, start observer
     *   3. Register storage change listener
     *   4. Set up SPA navigation detection
     */
    async function init() {
        try {
            settings = await Storage.getSettings();

            if (settings.enabled) {
                Tooltip.init();
                // Delay lets Reddit finish initial render
                setTimeout(() => findAndProcessContent(), 300);
                startObserver();
            }

            Storage.onSettingsChanged(handleSettingsChange);
            setupNavigationListeners();
        } catch (err) {
            console.error('[PromoHighlighter] Failed to initialise:', err);
        }
    }

    /* ====================================================================== */
    /*  Auto-start                                                            */
    /* ====================================================================== */

    init();

    return Object.freeze({ init });
})();
