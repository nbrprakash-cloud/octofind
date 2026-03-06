/**
 * @file        highlighter.js
 * @description Walks the DOM inside a comment element, finds text nodes
 *              that contain matched terms, and wraps them in styled
 *              <span> elements.  Carefully avoids code blocks, pre-formatted
 *              text, and already-processed highlights.
 *
 *              KEY DESIGN NOTE:
 *              We use <span> instead of <mark> because Reddit's Shreddit
 *              web-component styles and Shadow DOM can override <mark>
 *              to display:block, which stretches highlights full-width
 *              and breaks word rendering. <span> has zero default styling
 *              and is immune to these overrides.
 *
 * @module      PromoHighlighter.Highlighter
 * @version     0.1.1
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.Highlighter = (() => {
    const { CSS_CLASSES, SELECTORS } = window.PromoHighlighter;

    /**
     * Set of tag names we must never descend into when walking text nodes.
     * Built from SELECTORS.skippedTags for fast Set lookups.
     */
    const SKIP_TAGS = new Set(SELECTORS.skippedTags);

    /* ====================================================================== */
    /*  Private helpers                                                       */
    /* ====================================================================== */

    /**
     * Checks whether an element or any of its ancestors (up to the root)
     * is a tag we should skip.
     *
     * @param {Node}        node — The node to check.
     * @param {HTMLElement}  root — The root comment element (stop boundary).
     * @returns {boolean}   True if the node is inside a skipped tag.
     */
    function isInsideSkippedTag(node, root) {
        let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        while (el && el !== root) {
            if (SKIP_TAGS.has(el.tagName)) return true;
            // Skip if already inside one of our highlight elements
            if (el.tagName === 'PROMO-HL') return true;
            el = el.parentElement;
        }
        return false;
    }

    /**
     * Collects all text nodes under `root` that are eligible for
     * highlighting (not inside skipped tags).  Returns them in
     * document order.
     *
     * @param {HTMLElement} root — The comment body element.
     * @returns {Text[]} Array of acceptable text nodes.
     */
    function collectTextNodes(root) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (isInsideSkippedTag(node, root)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // Only accept nodes with actual text content
                    if (!node.textContent || node.textContent.trim().length === 0) {
                        return NodeFilter.FILTER_SKIP;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                },
            }
        );

        let current;
        while ((current = walker.nextNode())) {
            textNodes.push(current);
        }
        return textNodes;
    }

    /**
     * Builds a concatenated string from an array of text nodes, along
     * with a positional map that lets us trace character indices back
     * to the originating (textNode, offsetWithinNode) pair.
     *
     * @param {Text[]} textNodes
     * @returns {{ fullText: string, map: Array<{node: Text, start: number, end: number}> }}
     */
    function buildTextMap(textNodes) {
        let fullText = '';
        const map = [];

        for (const node of textNodes) {
            const start = fullText.length;
            fullText += node.textContent;
            map.push({ node, start, end: fullText.length });
        }

        return { fullText, map };
    }

    /**
     * Given a character range [matchStart, matchEnd) in the concatenated
     * fullText, resolves which text node(s) it spans and returns segments.
     *
     * @param {number} matchStart — Start index in fullText.
     * @param {number} matchEnd   — End index in fullText (exclusive).
     * @param {Array}  map        — The positional map from buildTextMap().
     * @returns {Array<{node: Text, offsetInNode: number, length: number}>}
     */
    function resolveToTextNodes(matchStart, matchEnd, map) {
        const segments = [];

        for (const entry of map) {
            // No overlap — skip
            if (entry.end <= matchStart || entry.start >= matchEnd) continue;

            const offsetInNode = Math.max(0, matchStart - entry.start);
            const segStart = Math.max(matchStart, entry.start);
            const segEnd = Math.min(matchEnd, entry.end);
            const length = segEnd - segStart;

            segments.push({ node: entry.node, offsetInNode, length });
        }

        return segments;
    }

    /**
     * Wraps a substring within a text node in a highlight <promo-hl>.
     *
     * We use a CUSTOM HTML ELEMENT instead of <span> or <mark> because
     * Reddit's CSS has rules targeting generic span/mark elements inside
     * .md containers that force block-level display. A custom element
     * has ZERO Reddit CSS rules targeting it — no specificity battle.
     *
     * Returns the nodes created AFTER the wrap so they can be
     * used to update the text-node map.
     *
     * @param {Text}     textNode  — The DOM Text node.
     * @param {number}   offset    — Character offset within the text node.
     * @param {number}   length    — Number of characters to wrap.
     * @param {string}   severity  — 'red' or 'yellow'.
     * @param {string[]} reasons   — Reason strings for the tooltip.
     * @param {string}   [analysisPayload] — Structured explanation payload.
     * @returns {{ el: HTMLElement, afterNode: Text|null }}
     */
    function wrapSegment(textNode, offset, length, severity, reasons, analysisPayload) {
        const text = textNode.textContent;

        // Guard: bounds check
        if (offset < 0 || offset + length > text.length) return null;

        const parent = textNode.parentNode;
        if (!parent) return null;

        // Split: [before] [matched] [after]
        const before = text.substring(0, offset);
        const matched = text.substring(offset, offset + length);
        const after = text.substring(offset + length);

        // Custom element — Reddit has ZERO CSS rules for <promo-hl>
        const el = document.createElement('promo-hl');
        el.className = severity === 'red'
            ? CSS_CLASSES.highlightRed
            : CSS_CLASSES.highlightYellow;
        el.textContent = matched;

        // Store data for the tooltip
        el.dataset.promoReasons = JSON.stringify(reasons);
        el.dataset.promoSeverity = severity;
        if (analysisPayload) {
            el.dataset.promoAnalysis = analysisPayload;
        }

        // Build replacement fragment
        const frag = document.createDocumentFragment();
        if (before) frag.appendChild(document.createTextNode(before));
        frag.appendChild(el);
        const afterNode = after ? document.createTextNode(after) : null;
        if (afterNode) frag.appendChild(afterNode);

        parent.replaceChild(frag, textNode);
        return { el, afterNode };
    }

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    /**
     * highlightComment
     * ----------------------------------------------------------------
     * Given a comment DOM element and an analysis result from the scoring
     * engine, highlights all matched terms within the comment's text.
     *
     * ALGORITHM:
     *  1. Collect all eligible text nodes under the comment.
     *  2. Concatenate their text into one string and build a position map.
     *  3. Run the keyword/domain regex on the concatenated string to find
     *     match positions that respect word boundaries correctly (even if
     *     the word is split across Reddit's internal DOM structure).
     *  4. For each match, resolve back to the originating text node(s)
     *     and wrap the relevant characters in highlight <span> elements.
     *  5. Process matches in REVERSE order to keep earlier text-node
     *     references and map indices stable.
     *
     * @param {HTMLElement} commentEl — The comment body element.
     * @param {{
     *   severity: string,
     *   reasons:  string[],
     *   matches:  Array<{term: string, index: number, length: number}>
     * }} analysis — Output from ScoringEngine.analyzeText().
     */
    function highlightComment(commentEl, analysis) {
        if (!analysis.severity || analysis.matches.length === 0) return;
        const analysisPayload = JSON.stringify(analysis.explanation || {});

        // 1. Collect text nodes
        const textNodes = collectTextNodes(commentEl);
        if (textNodes.length === 0) return;

        // 2. Build concatenated text + position map
        const { fullText, map } = buildTextMap(textNodes);

        // 3. Build regex from unique matched terms
        const uniqueTerms = [...new Set(analysis.matches.map((m) => m.term))];
        const escaped = uniqueTerms.map((t) =>
            t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

        // Find all matches in the concatenated text
        const allMatches = [];
        let match;
        while ((match = regex.exec(fullText)) !== null) {
            // Guard: zero-length matches produce invisible spans
            // that render as coloured bars — skip them
            if (match[0].length === 0) {
                regex.lastIndex++;
                continue;
            }
            allMatches.push({
                index: match.index,
                length: match[0].length,
                term: match[0],
            });
        }

        if (allMatches.length === 0) return;

        // 4. Process in REVERSE order (later matches first) so that
        //    wrapping earlier matches doesn't shift later indices.
        allMatches.reverse();

        for (const m of allMatches) {
            const segments = resolveToTextNodes(m.index, m.index + m.length, map);

            // Handle single-node matches (most common case)
            if (segments.length === 1) {
                const seg = segments[0];
                // The node reference in `map` might be stale if a previous
                // (later-in-doc) wrap modified ancestry, but since we process
                // in reverse, earlier nodes are untouched.
                if (seg.node.parentNode) {
                    wrapSegment(
                        seg.node,
                        seg.offsetInNode,
                        seg.length,
                        analysis.severity,
                        analysis.reasons,
                        analysisPayload
                    );
                }
            } else if (segments.length > 1) {
                // Multi-node match (rare: keyword spans across DOM elements).
                // Wrap each segment individually — they'll appear as adjacent
                // highlighted spans, which visually merge.
                for (let i = segments.length - 1; i >= 0; i--) {
                    const seg = segments[i];
                    if (seg.node.parentNode) {
                        wrapSegment(
                            seg.node,
                            seg.offsetInNode,
                            seg.length,
                            analysis.severity,
                            analysis.reasons,
                            analysisPayload
                        );
                    }
                }
            }
        }
    }

    /**
     * removeHighlights
     * ----------------------------------------------------------------
     * Removes all promo highlights and username badges from the page
     * (or a subtree). Used when the user disables the extension.
     *
     * @param {HTMLElement} [root=document.body] — Root element to clean.
     */
    function removeHighlights(root = document.body) {
        // Remove highlight <promo-hl> elements
        const highlights = root.querySelectorAll(
            `promo-hl.${CSS_CLASSES.highlightRed}, promo-hl.${CSS_CLASSES.highlightYellow}`
        );

        highlights.forEach((el) => {
            const parent = el.parentNode;
            if (!parent) return;

            // Replace <promo-hl> with its text content
            const textNode = document.createTextNode(el.textContent);
            parent.replaceChild(textNode, el);

            // Normalize merges adjacent text nodes back together
            parent.normalize();
        });

        // Remove username badges
        const badges = root.querySelectorAll('.' + CSS_CLASSES.usernameBadge);
        badges.forEach((badge) => badge.remove());
    }

    /* ====================================================================== */
    /*  Expose                                                                */
    /* ====================================================================== */

    return Object.freeze({ highlightComment, removeHighlights });
})();
