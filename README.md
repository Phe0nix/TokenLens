# TokenLens

TokenLens is a Chrome extension that scans live websites and extracts practical design tokens for design and development workflows.

## Live Demo URL

Replace this dummy URL with your real URL later:

- https://example.com/tokenlens

## What It Does

- Extracts tokens from live websites:
  - Colors
  - Typography (families, sizes, weights, line heights)
  - Spacing and border radius
  - Shadows and gradients
  - CSS variables from `:root`
- Inspect mode:
  - Pick an element directly on the page
  - Auto-capture element styles
  - Auto-return to extension UI after capture
  - Suggested token mapping for inspected colors
- Insights:
  - System and accessibility score
  - Plain-language style summary
  - Accessibility quick-fix suggestions
- History:
  - Save snapshots per page
  - Load and compare snapshots
  - Drift view with added/removed changes
- Export formats:
  - CSS variables
  - SCSS variables
  - Tailwind config
  - Figma tokens JSON
  - DTCG JSON
  - Plain JSON

## Beginner and Pro Modes

- Beginner mode keeps the UI simple and focused.
- Pro mode unlocks advanced options and workflows.

## Keyboard Shortcut

Default shortcut to open TokenLens:

- Windows/Linux: `Ctrl+Shift+Y`
- macOS: `Command+Shift+Y`

You can customize this in your browser extension shortcuts page.

## Project Structure

```
manifest.json
popup.html
css/
  popup.css
icons/
js/
  background.js
  content.js
  popup.js
```

## Local Setup

1. Open Chrome (or any Chromium browser).
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select this project folder.

## Notes

- Works on normal `http` and `https` pages.
- Browser internal pages are restricted by extension security rules.

## Roadmap Ideas

- Additional export integrations (Style Dictionary, platform-specific outputs)
- Team handoff report export
- More guided accessibility repair suggestions

## License

Add your preferred license here.
