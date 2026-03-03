# Changelog

All notable changes to the Reddit Promo Highlighter extension will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [SemVer](https://semver.org/).

## [0.1.0] — 2026-03-03

### Added
- Initial project scaffold and folder structure
- Manifest V3 configuration
- Content script engine with MutationObserver for Reddit SPA
- Keyword detector (configurable keyword list)
- Domain detector (`.ai`, `.io`, `.com`, `.co`, `.app`, `.dev`, `.tools`, `.so`)
- Pluggable scoring engine with configurable weights and thresholds
- DOM highlighter with red (high) and yellow (medium) severity
- Hover tooltips with dark-mode glassmorphism aesthetic
- Popup with quick on/off toggle
- Options page (dark-mode SaaS aesthetic): keyword editing, enable/disable, reset defaults
- Settings persisted via `chrome.storage.sync`
- File-hygiene conventions, audit trail, and changelog
