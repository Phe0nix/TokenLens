# Palext

<p align="center">
  <img src="https://img.shields.io/badge/Chrome_Extension-MV3-2ea44f?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension MV3" />
  <img src="https://img.shields.io/badge/Focus-Design_Tokens-0ea5e9?style=for-the-badge" alt="Design Tokens" />
  <img src="https://img.shields.io/badge/Export-CSS%20%7C%20SCSS%20%7C%20Tailwind%20%7C%20MUI%20%7C%20Ant%20%7C%20Chakra%20%7C%20Figma%20%7C%20DTCG%20%7C%20JSON-8b5cf6?style=for-the-badge" alt="Export Formats" />
</p>

<p align="center">
  Scan live websites, extract design tokens, inspect elements, compare snapshots with an interactive diff dashboard, and export ready-to-use outputs (including visual HTML audits) for design and development workflows.
</p>

## 🛍️ Install from Chrome Web Store

- Install Palext: https://chrome.google.com/webstore/detail/your-extension-id

## 🎯 What Palext Does

| Area | Capabilities |
|---|---|
| 🎨 Token Extraction | Colors, typography, spacing, radius, shadows, gradients, CSS variables from :root |
| 🔍 Inspect Mode | Click any element, auto-capture styles, auto-return to Palext |
| 🧠 Insights | System score, accessibility score, style summary, quick-fix suggestions, advanced accessibility report |
| 🕘 History | Save/load/delete snapshots, interactive diff cards, impact filters, drift metrics, sample toggles |
| 📦 Exports | CSS, SCSS, Tailwind, MUI theme, Ant Design theme, Chakra theme, Figma Tokens JSON, DTCG JSON, JSON, TypeScript/JS token objects, Markdown audit, visual HTML audit |
| 🧭 Surfaces | Popup + Side panel support with the same workflow |
| ⚙️ UX Modes | Beginner and Pro modes for progressive complexity |

## 📦 Unified Export Flow

- Open **Export** from popup or side panel.
- Choose output type: **Token format**, **Bundle**, or **Audit report**.
- For format export, choose framework family and format.
- Select token categories to include.
- Copy or download generated output with inline setup comments for framework exports.
- Audit output now supports:
  - **Copy** -> rich Markdown audit report (great for tickets/docs)
  - **Download** -> visual **HTML audit report** with cards, swatches, and priority queue

## 🧾 Audit Reports (Markdown + Visual HTML)

Palext generates actionable design-system audits for both developers and designers.

### Included in audit reports

- Executive summary and scorecards
- Priority fix queue with severity/owner/effort/task
- Accessibility deep dive with risky contrast pairs
- Palette merge candidates (near-duplicate color detection)
- Role-specific action packs (Developer / Designer)
- Token naming and variable adoption notes

### Why this helps

- Faster triage: see highest-impact fixes first
- Better handoff: clear ownership and effort guidance
- Better presentation: visual HTML report for stakeholder reviews

## ✨ Feature Highlights

| Feature | Why It Matters |
|---|---|
| 🔁 Auto-return Inspect Workflow | No manual reopen friction after selecting an element |
| 🧩 Inspect Token Suggestions | Suggests nearest existing token or recommended new token |
| ♿ Accessibility Quick Fixes | Converts diagnostics into practical color replacement suggestions |
| 📈 Interactive Snapshot Diff | Card-based drift dashboard with impact filters and sample details |
| 🧾 Dual Audit Export | Markdown for docs + polished HTML for presentations and reviews |
| 🧭 Beginner + Pro Experience | Supports both freshers and advanced users without UI clutter |
| ⌨️ Keyboard Shortcut | Open quickly with customizable shortcut |

## 🧑‍🎨 Why Designers Like It

- Turn any live interface into reusable token references in minutes.
- Audit style consistency across versions using snapshot comparison.
- Surface accessibility risks early with plain-language guidance.
- Communicate system-level design patterns using concise insights.

## 👨‍💻 Why Developers Like It

- Reduce manual DevTools inspection and repetitive style extraction.
- Export directly into common implementation formats.
- Export visual HTML audits for PM/design/dev review without extra tooling.
- Keep token systems consistent with history-based drift tracking.
- Speed up component build-out with inspect-to-token mapping hints.

## 🥇 What Makes Palext Unique

| Unique Point | Palext Advantage |
|---|---|
| Inspect Experience | Click element -> capture -> return automatically |
| Actionable Insights | Includes quick fixes, not just pass/fail metrics |
| Interactive Diff UX | Impact-filtered drift cards instead of static lists |
| Audit Outputs | Markdown + visual HTML reports generated locally |
| Lightweight Workflow | Fast popup/side panel flow without external setup |
| Dual Audience UX | Beginner clarity + Pro depth in one extension |

## ⚖️ Comparison with Existing Tool Types

| Tool Type | Typical Behavior | Palext Difference |
|---|---|---|
| Basic Color Pickers | Single color copy/pick | Full token extraction + exports + insights |
| Simple Token Extractors | Raw extraction only | Inspect, accessibility fixes, history compare |
| Heavy Token Platforms | Powerful but complex setup | Fast browser-native workflow for day-to-day audits |
