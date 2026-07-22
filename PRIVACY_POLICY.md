# 🔒 Privacy Policy — Palext

<p align="center">
  <img src="https://img.shields.io/badge/Last_Updated-July_2026-0ea5e9?style=flat-square" />
  <img src="https://img.shields.io/badge/Compliance-Chrome_Extension_Policy-2ea44f?style=flat-square&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/Data_Collected-None-22c55e?style=flat-square" />
</p>

---

## Overview

Palext is a Chrome extension that extracts design tokens from websites you visit. This policy explains clearly and completely what data Palext accesses, what it stores, and what it never does.

---

## 👤 Who We Are

**Extension Name:** Palext — Design Token Extractor  
**Developer:** Phe0nix  
**Repository:** https://github.com/Phe0nix/Palext  
**Live Demo:** https://palext.vercel.app/

---

## 🧩 Free vs Pro Access (Privacy-First in both modes)

Palext has Free and Pro feature access levels, but privacy behavior is identical in both.

| Plan | Feature access summary | Data handling |
|---|---|---|
| Free | Core scanning, inspect workflow, core exports, limited quotas | Local-only processing and local-only storage |
| Pro | Unlocks advanced exports, unlimited workflows, deeper audit utilities | Local-only processing and local-only storage |

No matter which plan is active, Palext does not transmit scanned website data to external servers.

---

## 📋 What Data Palext Accesses

When you open Palext on a web page, the extension reads the **computed CSS styles** of elements on that page to extract design tokens such as colors, typography, spacing, and CSS variables.

| Data Accessed | Purpose | Stored? | Shared? |
|---|---|---|---|
| Page CSS styles (colors, fonts, spacing) | Token extraction | Locally only | ❌ Never |
| Page URL and title | Snapshot labeling | Locally only | ❌ Never |
| Snapshots you save | History comparison | Locally only | ❌ Never |
| Inspect element styles | Element token view | Locally only | ❌ Never |
| Export preferences, selected format/family, and UI mode | Remembering your settings | Locally only | ❌ Never |
| Accessibility diagnostics (contrast pass/fail counts, risky pairs) | Build on-device insights and audit reports | Locally only | ❌ Never |

---

## 🚫 What Palext Never Does

- ❌ Does **not** collect or transmit any personal information
- ❌ Does **not** send any data to external servers or third parties
- ❌ Does **not** track your browsing history or behavior
- ❌ Does **not** use cookies or tracking pixels
- ❌ Does **not** access login credentials, form inputs, or private content
- ❌ Does **not** run any analytics or telemetry
- ❌ Does **not** display advertisements

---

## 💾 Local Storage

Palext uses the browser's built-in **`chrome.storage.local`** API to save:

- Saved page snapshots (when you click the bookmark button)
- Export preferences and UI mode selection
- Inspect results temporarily captured during element inspection

This data is stored entirely on your device, never leaves your browser, and is accessible only to the Palext extension itself. You can clear all stored data at any time from the extension's History tab.

Palext's generated outputs (token exports, Markdown audits, and visual HTML audits) are created entirely in your browser from page style data and only leave your device if you explicitly choose to copy or download them.

---

## 🔑 Permissions Explained

Chrome requires extensions to declare permissions. Here is why each permission Palext uses is necessary:

| Permission | Why It Is Needed |
|---|---|
| `activeTab` | Reads CSS styles of the currently open tab when you trigger extraction |
| `storage` | Saves your snapshots, preferences, and inspect results locally |
| `clipboardWrite` | Copies exported token code or audit markdown to your clipboard when you click copy |
| `scripting` | Re-injects the extraction script if the page was opened before the extension was installed |
| `host_permissions` (http/https) | Allows the content script to run on normal web pages for token extraction |

No permission is used beyond its stated purpose.

---

## 🌐 Third-Party Services

Palext does **not** integrate with, connect to, or send data to any third-party service, API, or analytics platform.

The extension operates entirely offline and locally within your browser.

Exports (including CSS/SCSS/Tailwind/MUI/Ant/Chakra/Figma/DTCG/JSON/TS/JS output, plus Markdown and visual HTML audits) are generated locally in your browser from the page styles you choose to scan.

---

## 🧒 Children's Privacy

Palext does not knowingly collect any information from anyone, including children under 13. Since no data is collected at all, this extension is safe for use by all age groups.

---

## 🔄 Changes to This Policy

If this privacy policy is updated, the **Last Updated** date at the top of this document will reflect the change. Significant changes will also be noted in the extension's update release notes on the Chrome Web Store.

---

## 📬 Contact

If you have any questions about this privacy policy or how Palext works, please contact:

- **GitHub:** https://github.com/Phe0nix/Palext/issues

---

<p align="center">
  <sub>Palext is built with user privacy as a core principle. No data leaves your device. Ever.</sub>
</p>
