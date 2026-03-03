# Reddit Promo Highlighter

A lightweight Chrome Extension (Manifest V3) that scans Reddit comments in real-time and highlights likely promotional tool/app mentions with severity-coded highlights and hover tooltips.

## Features

- **Real-time scanning** — Detects promotional mentions as comments load via MutationObserver
- **Keyword detection** — Configurable list of app/tool names to watch for
- **Domain detection** — Flags domain-like tokens (`.ai`, `.io`, `.com`, etc.)
- **Severity highlighting** — Red (high likelihood) and Yellow (medium likelihood)
- **Hover tooltips** — See exactly why a mention was flagged
- **Quick toggle** — Enable/disable from the popup in one click
- **Full options page** — Edit keywords, adjust settings, dark-mode UI

## Installation (Developer Mode)

1. Clone or download this repository
2. Open Chrome → navigate to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `octofind/` folder
5. The extension icon appears in your toolbar — you're ready to go

## Architecture

```
Content Script (reddit.com)
  └─ MutationObserver → detects new/changed comments
      └─ Scoring Engine → runs pluggable detectors
          ├─ Keyword Detector
          └─ Domain Detector
      └─ Highlighter → wraps matches in <mark> elements
      └─ Tooltip → displays reasons on hover

Popup → quick on/off toggle via chrome.storage.sync
Options Page → keyword editing, settings, reset defaults
Service Worker → seeds defaults on install
```

## License

MIT — see [LICENSE](./LICENSE)
