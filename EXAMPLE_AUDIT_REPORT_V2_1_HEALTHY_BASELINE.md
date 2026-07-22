# Design System Audit v2.1 — docs.github.com ✨

## Executive Strip

| Field | Value | Field | Value |
| --- | --- | --- | --- |
| 🕒 Generated | 2026-07-18T13:05:22 | 🧾 Scan | GH-20260718-130522 |
| 🛠 Tool | Palext v2.1 | 🌐 URL | https://docs.github.com/ |
| 🧪 Env | prod | 🖥 Viewport | 1366x768 |
| 🎨 Theme | light | 🔐 Auth | logged-out |

---

## At a Glance 👀

| Health | Value | Status |
| --- | ---: | --- |
| System consistency | 91/100 | 🟢 Strong |
| Palette accessibility | 94/100 | 🟢 Strong |
| Live WCAG AA fails | 7 / 612 | 🟢 1.1% fail density |
| Estimated lift after top fixes | +3 pts | ✅ High confidence |

**Primary user risk:** Minor contrast drift in a few secondary text contexts; core task flows remain readable.

| Signal | Visual Meter | Meaning |
| --- | --- | --- |
| Consistency | 🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜ | High design-system alignment |
| Accessibility | 🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜ | Strong AA baseline |
| Delivery risk | 🟨⬜⬜⬜⬜⬜⬜⬜⬜⬜ | Low, localized fixes |

---

## Top Fixes (Impact First) 🚀

| Rank | Area | Issue Group | User Impact | Priority | Effort | Owner | Expected Lift | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 🥇 | Secondary meta text | G-LIVE-AA-011 | Slight reading fatigue in long docs pages | 🟠 P1 | S | Dev + Design | +1 | Raise low-emphasis text token contrast by one step |
| 2 🥈 | Link state contrast | G-LINK-STATE-004 | Hover/focus states can feel subtle on tinted sections | 🟠 P1 | S | Design | +1 | Align state tokens with contrast-safe interaction matrix |
| 3 🥉 | Legacy utility styles | G-HARDCODE-006 | Potential future drift from token standards | 🟡 P2 | S | Dev | +1 | Replace remaining hardcoded values with semantic tokens |

---

## Scoreboard 📊

| Metric | Value | Quick Note |
| --- | ---: | --- |
| Token consistency | 91% | ✅ Good system discipline |
| Palette accessibility | 94% | ✅ Most pairs already AA-safe |
| AA normal pass rate | 96% | ✅ 127/132 |
| Live fail density | 1.1% | ✅ 7/612 |
| Hardcoded style occurrences | 64 | ⚠️ Low and mostly legacy |

---

## Priority Queue 🧭

| Priority | Issue | Why it matters | Owner | Effort | Recommended task |
| --- | --- | --- | --- | --- | --- |
| 🟠 P1 | 7 live WCAG AA text failures | Small but visible polish opportunity | Developer + Designer | Low | Patch failing selectors and re-run scan |
| 🟠 P1 | Link interaction state softness | Discoverability and perceived quality | Designer | Low | Increase hover/focus contrast on tinted containers |
| 🟡 P2 | 64 hardcoded style occurrences | Avoid long-term consistency drift | Developer | Low | Map to semantic tokens in shared utilities |

---

## Token Inventory 🧩

| Tokens | Count | Tokens | Count |
| --- | ---: | --- | ---: |
| Colors | 41 | Radii | 8 |
| Font families | 3 | Shadows | 6 |
| Font sizes | 10 | Gradients | 3 |
| Spacing values | 9 | CSS variables (:root) | 608 |

---

## Accessibility Snapshot ♿

| Check | Pass / Total | Pass Rate |
| --- | --- | ---: |
| AA Normal | 127/132 | 🟢 96% |
| AA Large | 130/132 | 🟢 98% |
| AAA Normal | 108/132 | 🟡 82% |
| AAA Large | 126/132 | 🟢 95% |

**Risky pairs (<3:1):**

| Pair | Ratio | Risk |
| --- | ---: | --- |
| #6E7781 on #F6F8FA | 2.89:1 | 🟠 Watch |
| #57606A on #F3F4F6 | 2.94:1 | 🟡 Near threshold |
| #768390 on #F6F8FA | 2.73:1 | 🔴 Highest in this set |

---

## Role Action Packs 🛠

### Developer

| # | Action | Impact |
| --- | --- | --- |
| 1 | Update remaining failing selector groups with approved text/surface pairs. | Immediate AA uplift |
| 2 | Replace legacy hardcoded color and spacing utilities with semantic token references. | Long-term consistency |
| 3 | Add contrast lint checks in pre-merge UI verification. | Regression prevention |

### Designer

| # | Action | Impact |
| --- | --- | --- |
| 1 | Finalize interaction-state contrast thresholds for links and muted text. | Better interaction clarity |
| 2 | Publish a "low-emphasis text" token usage matrix by background type. | Faster design decisions |
| 3 | Review AAA opportunities on high-traffic docs templates. | Premium readability |

---

## Trend vs Previous Scan 📈

| Previous Scan | Consistency | Live Fails | Hardcoded | Status |
| --- | --- | --- | --- | --- |
| GH-20260704-094120 | ⬆ +3 | ⬇ -5 | ⬇ -18 | 🟢 Healthy and improving |

---

## Re-test Plan 🔁

| Track | Scope |
| --- | --- |
| Fast scope | Article headers, side nav, pagination links, callout cards |
| Full scope | Docs homepage, article templates, version switcher, search overlays |

| Pass Criteria | Target |
| --- | --- |
| Live AA fails | <= 3 |
| AA normal pass | >= 98% |
| New P0 groups | 0 |

---

<details>
<summary><strong>Deep Details (expand only when needed)</strong></summary>

## A) Method and Confidence 🧠

| Section | Confidence | Method | Why |
| --- | --- | --- | --- |
| Token inventory | High | CSS variable map + computed style sampling | Stable across repeated scans |
| Palette analysis | High | Pairwise contrast on active + semantic palette | Manageable set and clear lineage |
| Live WCAG | High | Visible text-node contrast check on key templates | Low variance across nav/page states |
| Hardcoded detection | Medium | Static + runtime rule matching against token refs | Some utility classes collapse distinct cases |

## B) WCAG Compliance Mapping 📚

| Issue Group | WCAG SC | Level | Conformance Risk | Notes |
| --- | --- | --- | --- | --- |
| G-LIVE-AA-011 | 1.4.3 Contrast (Minimum) | AA | Low | Concentrated in secondary metadata text |
| G-LINK-STATE-004 | 1.4.1 Use of Color / 1.4.3 Contrast | AA | Low | Hover/focus distinction can be subtle |
| G-TEXT-AAA-007 | 1.4.6 Contrast (Enhanced) | AAA | Medium | Optional enhancement area, not release blocker |

## C) Evidence Pack (sample) 🔎

| Group ID | Component Signature | CSS Selector | Sample DOM Path | Screenshot Ref | Repro Steps |
| --- | --- | --- | --- | --- | --- |
| G-LIVE-AA-011 | Article metadata text | `.article-meta .text-small` | `body > main > article ...` | `screenshots/G-LIVE-AA-011.png` | Open article page and run WCAG overlay |
| G-LINK-STATE-004 | Side-nav links on hover | `.toc-link:hover` | `body > div.Layout ...` | `screenshots/G-LINK-STATE-004.png` | Hover side-nav links in long article template |

## D) Issue Grouping (Noise Reduction) 🧹

| Group ID | Issue Type | Unique Nodes | Repeated Instances | Priority | Owner |
| --- | --- | ---: | ---: | --- | --- |
| G-LIVE-AA-011 | Live AA text fail | 4 | 7 | P1 | Dev + Design |
| G-LINK-STATE-004 | State contrast softness | 3 | 9 | P1 | Design |
| G-HARDCODE-006 | Hardcoded style | 21 | 64 | P2 | Dev |

## E) Exception / Waiver Register 🧾

| Waiver ID | Group ID | Reason | Approved By | Expires On | Status |
| --- | --- | --- | --- | --- | --- |
| W-2026-07-18-04 | G-HARDCODE-006 | Legacy markdown renderer migration in progress | Frontend Lead | 2026-10-01 | Temporary |

## F) Multi-page Rollup (optional) 🗂

| Page | P0 Groups | Live AA Fails | Hardcoded Occurrences | Overall Status |
| --- | ---: | ---: | ---: | --- |
| / | 0 | 2 | 27 | Healthy |
| /en/get-started | 0 | 3 | 19 | Healthy |
| /en/actions | 0 | 2 | 18 | Healthy |

## G) Workflow Integration Fields 🔗

| Group ID | Jira Key | GitHub Issue | Owner Team | SLA Target | Ticket Status |
| --- | --- | --- | --- | --- | --- |
| G-LIVE-AA-011 | DS-341 | #911 | Docs Frontend | 10 days | In Progress |
| G-LINK-STATE-004 | DS-342 | #912 | Design Systems | 14 days | Open |

## H) Contradiction Note 🧭

High palette accessibility and high live pass rates are aligned in this scan. Remaining failures are localized to secondary text and link-state edge cases, indicating a mature baseline with targeted polish work left.

</details>

---

## Companion JSON (CI + Tickets) — Example Payload 📦

```json
{
  "scan": {
    "id": "GH-20260718-130522",
    "generatedAt": "2026-07-18T13:05:22Z",
    "toolVersion": "Palext v2.1",
    "url": "https://docs.github.com/",
    "viewport": { "width": 1366, "height": 768 },
    "themeMode": "light",
    "authState": "logged-out",
    "scope": "main frame only",
    "exclusions": {
      "hiddenNodes": true,
      "disabledControls": true,
      "decorativeText": true
    }
  },
  "scores": {
    "consistency": 91,
    "paletteAccessibility": 94,
    "aaNormalPassRate": 96,
    "liveFailDensity": 1.1
  },
  "totals": {
    "liveChecked": 612,
    "liveFails": 7,
    "hardcodedOccurrences": 64
  },
  "topFixes": [
    {
      "rank": 1,
      "component": "Secondary meta text",
      "issueGroupId": "G-LIVE-AA-011",
      "userImpact": "Minor reading fatigue in long-form docs",
      "severity": "P1",
      "effort": "S",
      "owner": "Developer + Designer",
      "expectedLift": "+1"
    }
  ]
}
```
