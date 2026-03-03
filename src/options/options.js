/**
 * @file        options.js
 * @description Logic for the full options / settings page.
 *              Loads settings on DOMContentLoaded, saves on button click,
 *              and provides reset-to-defaults with confirmation.
 * @module      PromoHighlighter.Options
 * @version     0.1.0
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'promoHighlighterSettings';

    /* ---------------------------------------------------------------------- */
    /*  Default settings (duplicated for the options page context)            */
    /* ---------------------------------------------------------------------- */

    const DEFAULT_KEYWORDS = [
        'Airtable', 'Beehiiv', 'Canva', 'ChatGPT', 'ClickUp', 'Copilot',
        'Cursor', 'Descript', 'Figma', 'Framer', 'Gamma', 'Grammarly',
        'Jasper', 'Jira', 'Lemon Squeezy', 'Linear', 'Loophole', 'Mailchimp',
        'Midjourney', 'Miro', 'Monday', 'Notion', 'Obsidian', 'Otter',
        'Perplexity', 'Pitch', 'Raycast', 'Replika', 'Runway', 'Semrush',
        'ShipFast', 'Slack', 'Stripe', 'Substack', 'Superhuman', 'Surfer SEO',
        'Tally', 'Taskade', 'Todoist', 'Trello', 'Typeform', 'Vercel',
        'Webflow', 'Writesonic', 'Zapier',
    ];

    const DEFAULT_SETTINGS = {
        enabled: true,
        keywords: [...DEFAULT_KEYWORDS],
    };

    /* ---------------------------------------------------------------------- */
    /*  DOM Elements                                                          */
    /* ---------------------------------------------------------------------- */

    const toggleCheckbox = document.getElementById('opt-enabled');
    const toggleStatusLabel = document.getElementById('toggle-status-label');
    const keywordsTextarea = document.getElementById('opt-keywords');
    const keywordCount = document.getElementById('keyword-count');
    const btnSave = document.getElementById('btn-save');
    const btnReset = document.getElementById('btn-reset');
    const toastEl = document.getElementById('toast');
    const toastIcon = document.getElementById('toast-icon');
    const toastMessage = document.getElementById('toast-message');

    /* ---------------------------------------------------------------------- */
    /*  Toast System                                                          */
    /* ---------------------------------------------------------------------- */

    /** Timer ID for auto-hiding the toast. */
    let toastTimer = null;

    /**
     * Shows a toast notification.
     *
     * @param {string} message — Text to display.
     * @param {'success'|'error'|'info'} type — Visual type.
     * @param {number} duration — How long to show (ms).
     */
    function showToast(message, type = 'success', duration = 3000) {
        // Clear any existing timer
        if (toastTimer) clearTimeout(toastTimer);

        // Set content
        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        toastIcon.textContent = icons[type] || '✓';
        toastMessage.textContent = message;

        // Set type class
        toastEl.className = `toast toast-${type} toast-visible`;

        // Auto-hide
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('toast-visible');
        }, duration);
    }

    /* ---------------------------------------------------------------------- */
    /*  Helpers                                                               */
    /* ---------------------------------------------------------------------- */

    /**
     * Parses the textarea content into a clean array of keywords.
     * Trims whitespace, removes empty lines and duplicates.
     *
     * @returns {string[]} Cleaned keyword array.
     */
    function parseKeywords() {
        const raw = keywordsTextarea.value;
        const lines = raw.split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

        // Deduplicate (case-insensitive) while preserving original casing
        const seen = new Set();
        const unique = [];
        for (const line of lines) {
            const key = line.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(line);
            }
        }

        return unique;
    }

    /**
     * Updates the keyword count display.
     * @param {number} count
     */
    function updateKeywordCount(count) {
        keywordCount.textContent = `${count} keyword${count !== 1 ? 's' : ''}`;
    }

    /**
     * Updates the toggle status label.
     * @param {boolean} enabled
     */
    function updateToggleLabel(enabled) {
        toggleStatusLabel.textContent = enabled ? 'Active' : 'Paused';
        toggleStatusLabel.classList.toggle('disabled', !enabled);
    }

    /**
     * Populates the UI with the given settings object.
     * @param {Object} settings
     */
    function populateUI(settings) {
        toggleCheckbox.checked = settings.enabled;
        updateToggleLabel(settings.enabled);
        keywordsTextarea.value = (settings.keywords || []).join('\n');
        updateKeywordCount((settings.keywords || []).length);
    }

    /* ---------------------------------------------------------------------- */
    /*  Load Settings                                                         */
    /* ---------------------------------------------------------------------- */

    chrome.storage.sync.get(STORAGE_KEY, (result) => {
        const settings = result[STORAGE_KEY]
            ? { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] }
            : { ...DEFAULT_SETTINGS };
        populateUI(settings);
    });

    /* ---------------------------------------------------------------------- */
    /*  Event Listeners                                                       */
    /* ---------------------------------------------------------------------- */

    // Toggle change — save immediately, no need to click "Save"
    toggleCheckbox.addEventListener('change', () => {
        updateToggleLabel(toggleCheckbox.checked);
        chrome.storage.sync.get(STORAGE_KEY, (result) => {
            const settings = result[STORAGE_KEY] || { ...DEFAULT_SETTINGS };
            settings.enabled = toggleCheckbox.checked;
            chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
                showToast(
                    settings.enabled ? 'Extension enabled' : 'Extension paused',
                    'info'
                );
            });
        });
    });

    // Update keyword count as user types
    keywordsTextarea.addEventListener('input', () => {
        const keywords = parseKeywords();
        updateKeywordCount(keywords.length);
    });

    // Save button
    btnSave.addEventListener('click', () => {
        const keywords = parseKeywords();

        chrome.storage.sync.get(STORAGE_KEY, (result) => {
            const settings = result[STORAGE_KEY] || { ...DEFAULT_SETTINGS };
            settings.keywords = keywords;
            settings.enabled = toggleCheckbox.checked;

            chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
                // Re-populate to show de-duplicated / cleaned list
                keywordsTextarea.value = keywords.join('\n');
                updateKeywordCount(keywords.length);
                showToast('Settings saved successfully', 'success');
            });
        });
    });

    // Reset button — confirm before wiping
    btnReset.addEventListener('click', () => {
        const confirmed = window.confirm(
            'Reset all settings to factory defaults?\n\n' +
            'This will restore the original keyword list and enable the extension. ' +
            'Your custom keywords will be lost.'
        );

        if (!confirmed) return;

        const freshSettings = { ...DEFAULT_SETTINGS, keywords: [...DEFAULT_KEYWORDS] };

        chrome.storage.sync.set({ [STORAGE_KEY]: freshSettings }, () => {
            populateUI(freshSettings);
            showToast('Settings reset to defaults', 'info');
        });
    });

    // Keyboard shortcut: Ctrl+S / Cmd+S to save
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            btnSave.click();
        }
    });
})();
