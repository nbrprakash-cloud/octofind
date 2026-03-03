/**
 * @file        storage.js
 * @description Thin wrapper around chrome.storage.sync for reading,
 *              writing, resetting settings, and listening for live
 *              changes.  Every other module goes through this wrapper —
 *              never call chrome.storage directly.
 * @module      PromoHighlighter.Storage
 * @version     0.1.0
 */

window.PromoHighlighter = window.PromoHighlighter || {};

window.PromoHighlighter.Storage = (() => {
    /* ====================================================================== */
    /*  Private helpers                                                       */
    /* ====================================================================== */

    /** The key under which all settings live in chrome.storage.sync. */
    const STORAGE_KEY = 'promoHighlighterSettings';

    /* ====================================================================== */
    /*  Public API                                                            */
    /* ====================================================================== */

    /**
     * getSettings
     * ----------------------------------------------------------------
     * Reads the current settings from chrome.storage.sync.
     * Falls back to DEFAULT_SETTINGS if nothing is stored yet.
     *
     * @returns {Promise<Object>} Resolved with the settings object.
     */
    async function getSettings() {
        return new Promise((resolve) => {
            chrome.storage.sync.get(STORAGE_KEY, (result) => {
                const stored = result[STORAGE_KEY];
                if (stored) {
                    // Merge with defaults so new fields added in future versions
                    // are always present even if the stored object is stale.
                    resolve({ ...window.PromoHighlighter.DEFAULT_SETTINGS, ...stored });
                } else {
                    resolve({ ...window.PromoHighlighter.DEFAULT_SETTINGS });
                }
            });
        });
    }

    /**
     * saveSettings
     * ----------------------------------------------------------------
     * Writes the given settings object to chrome.storage.sync.
     * Triggers onChanged listeners in all contexts (content script,
     * popup, options page).
     *
     * @param {Object} settings — Full settings object to persist.
     * @returns {Promise<void>}
     */
    async function saveSettings(settings) {
        return new Promise((resolve) => {
            chrome.storage.sync.set({ [STORAGE_KEY]: settings }, resolve);
        });
    }

    /**
     * resetSettings
     * ----------------------------------------------------------------
     * Overwrites stored settings with DEFAULT_SETTINGS.
     *
     * @returns {Promise<void>}
     */
    async function resetSettings() {
        return saveSettings({ ...window.PromoHighlighter.DEFAULT_SETTINGS });
    }

    /**
     * onSettingsChanged
     * ----------------------------------------------------------------
     * Registers a callback that fires whenever settings change in
     * any Chrome context (popup toggled, options page saved, etc.).
     *
     * @param {Function} callback — Receives (newSettings: Object).
     */
    function onSettingsChanged(callback) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'sync' || !changes[STORAGE_KEY]) return;
            const newSettings = changes[STORAGE_KEY].newValue;
            if (newSettings) {
                callback({ ...window.PromoHighlighter.DEFAULT_SETTINGS, ...newSettings });
            }
        });
    }

    /* ====================================================================== */
    /*  Expose public API                                                     */
    /* ====================================================================== */

    return Object.freeze({
        getSettings,
        saveSettings,
        resetSettings,
        onSettingsChanged,
    });
})();
