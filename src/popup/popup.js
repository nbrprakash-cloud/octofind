/**
 * @file        popup.js
 * @description Logic for the browser-action popup.  Reads the enabled
 *              state on open, toggles on click, and provides a link
 *              to the full options page.
 * @module      PromoHighlighter.Popup
 * @version     0.1.0
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'promoHighlighterSettings';

    /* ---------------------------------------------------------------------- */
    /*  DOM Elements                                                          */
    /* ---------------------------------------------------------------------- */

    const toggleCheckbox = document.getElementById('toggle-enabled');
    const statusText = document.getElementById('status-text');
    const openOptionsBtn = document.getElementById('open-options');

    /* ---------------------------------------------------------------------- */
    /*  Helpers                                                               */
    /* ---------------------------------------------------------------------- */

    /**
     * Updates the status label based on the enabled state.
     * @param {boolean} enabled
     */
    function updateStatus(enabled) {
        statusText.textContent = enabled
            ? 'Scanning Reddit comments for promotions'
            : 'Extension paused — highlights disabled';
        statusText.style.color = enabled
            ? 'rgba(100, 220, 255, 0.5)'
            : 'rgba(255, 150, 100, 0.5)';
    }

    /* ---------------------------------------------------------------------- */
    /*  Init                                                                  */
    /* ---------------------------------------------------------------------- */

    // Load current settings and set the toggle state
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
        const settings = result[STORAGE_KEY] || { enabled: true };
        toggleCheckbox.checked = settings.enabled;
        updateStatus(settings.enabled);
    });

    /* ---------------------------------------------------------------------- */
    /*  Event Listeners                                                       */
    /* ---------------------------------------------------------------------- */

    // Toggle: flip the enabled state in storage
    toggleCheckbox.addEventListener('change', () => {
        chrome.storage.sync.get(STORAGE_KEY, (result) => {
            const settings = result[STORAGE_KEY] || { enabled: true };
            settings.enabled = toggleCheckbox.checked;
            chrome.storage.sync.set({ [STORAGE_KEY]: settings }, () => {
                updateStatus(settings.enabled);
            });
        });
    });

    // Open full options page
    openOptionsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
})();
