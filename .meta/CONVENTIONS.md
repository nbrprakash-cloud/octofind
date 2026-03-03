# File Naming & Structure Conventions

> **Version:** 0.1.0 | **Last audited:** 2026-03-03

## Folder Structure Rules

| Folder | Purpose | Contents |
|--------|---------|----------|
| `.meta/` | Project metadata & hygiene | Changelog, conventions, audit trail |
| `src/background/` | Service worker (MV3 lifecycle) | Single `service-worker.js` |
| `src/content/` | Content scripts injected into Reddit | Detectors, engine, UI, entry point |
| `src/content/detectors/` | Pluggable scoring detectors | One file per detector |
| `src/popup/` | Browser action popup | HTML + CSS + JS triple |
| `src/options/` | Options page | HTML + CSS + JS triple |
| `src/shared/` | Cross-context utilities | Constants, defaults, storage wrapper |
| `assets/icons/` | Extension icons | PNG at 16, 48, 128px |

## Naming Conventions

- **Folders:** lowercase, hyphen-delimited → `keyword-detector`, not `KeywordDetector`
- **Files:** lowercase, hyphen-delimited → `scoring-engine.js`, not `scoringEngine.js`
- **CSS classes:** prefixed `promo-hl-` → `promo-hl-red`, `promo-hl-tooltip`
- **JS namespace:** `window.PromoHighlighter.ModuleName`
- **No abbreviations** in file names — prefer clarity over brevity

## Versioning

- Follow **SemVer** (`MAJOR.MINOR.PATCH`)
- Update `manifest.json` → `version` AND `.meta/CHANGELOG.md` on every release
- Pre-release tags: `0.x.y` until stable

## Archival Policy (Never Delete)

1. **Never delete files** from version control without team consensus
2. If a file becomes obsolete, move it to `.meta/archive/<original-path>/`
3. Log every archival action in `AUDIT_TRAIL.md` with: date, file, rationale, reviewer
4. Archived files retain their original name with a `-archived-YYYY-MM-DD` suffix

## File Metadata Requirements

Every JS file must include a header comment block:
```
/**
 * @file        filename.js
 * @description Brief purpose of this module
 * @module      PromoHighlighter.ModuleName
 * @version     0.1.0
 */
```
