# File Hygiene Checklist

Run this checklist before every release or PR.

## Structure
- [ ] All files reside in their designated folder (per CONVENTIONS.md)
- [ ] No files exist at the project root except `manifest.json`, `README.md`, `LICENSE`
- [ ] No empty/orphaned folders

## Naming
- [ ] All folders are lowercase, hyphen-delimited
- [ ] All files are lowercase, hyphen-delimited
- [ ] CSS classes use `promo-hl-` prefix
- [ ] JS modules attach to `window.PromoHighlighter.*`

## Duplicates & Obsoletes
- [ ] No duplicate files (same content, different name)
- [ ] No draft/temp files left in source folders
- [ ] Obsolete files moved to `.meta/archive/` with audit log entry

## Metadata
- [ ] Every JS file has a `@file` / `@description` / `@module` / `@version` header
- [ ] `manifest.json` version matches `CHANGELOG.md` latest entry
- [ ] `CHANGELOG.md` updated for all user-facing changes
- [ ] `AUDIT_TRAIL.md` updated for any file moves/renames

## Quality
- [ ] No `console.log` left in production code (only `console.warn`/`error` for real issues)
- [ ] No commented-out dead code
- [ ] All functions have JSDoc comments
