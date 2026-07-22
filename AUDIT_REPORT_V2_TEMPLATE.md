# Design System Audit

Use this template for high-signal reports that are easy to skim and still deep enough for engineering/compliance workflows.

---

## Scan Details

`Generated {{timestamp_iso}}` | `Scan {{scan_id}}` | `Tool {{tool_version}}` | `URL {{url}}`

`Env {{env}}` | `Viewport {{viewport_width}}x{{viewport_height}}` | `Theme {{theme_mode}}` | `Auth {{auth_state}}`

---

## Quick Summary

| Health | Value | Status |
| --- | ---: | --- |
| System consistency | {{consistency_score}}/100 | {{consistency_tier}} |
| Palette accessibility | {{palette_score}}/100 | {{palette_tier}} |
| Live WCAG AA fails | {{live_fail_count}} / {{live_checked_count}} | {{live_fail_density}}% fail density |
| Estimated lift after top fixes | +{{estimated_lift_points}} pts | {{estimated_lift_label}} |

**Primary user risk:** {{primary_risk_statement}}

---

## Fix These First

| Rank | Area | Issue Group | User Impact | Priority | Effort | Owner | Expected Lift | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | {{component_1}} | {{issue_group_1}} | {{impact_1}} | {{sev_1}} | {{effort_1}} | {{owner_1}} | {{lift_1}} | {{action_1}} |
| 2 | {{component_2}} | {{issue_group_2}} | {{impact_2}} | {{sev_2}} | {{effort_2}} | {{owner_2}} | {{lift_2}} | {{action_2}} |
| 3 | {{component_3}} | {{issue_group_3}} | {{impact_3}} | {{sev_3}} | {{effort_3}} | {{owner_3}} | {{lift_3}} | {{action_3}} |

---

## Health Scores

| Metric | Value | Quick Note |
| --- | ---: | --- |
| Token consistency | {{consistency_score}}% | {{consistency_note}} |
| Palette accessibility | {{palette_score}}% | {{palette_note}} |
| AA normal pass rate | {{aa_normal_pass_rate}}% | {{aa_normal_pass}}/{{aa_normal_total}} |
| Live fail density | {{live_fail_density}}% | {{live_fail_count}}/{{live_checked_count}} |
| Hardcoded style occurrences | {{hardcoded_occurrences}} | {{hardcoded_note}} |

---

## Action List by Priority

| Priority | Issue | Reason | Owner | Effort | Recommended task |
| --- | --- | --- | --- | --- | --- |
| P0 | {{p0_issue}} | {{p0_why}} | {{p0_owner}} | {{p0_effort}} | {{p0_task}} |
| P1 | {{p1_issue}} | {{p1_why}} | {{p1_owner}} | {{p1_effort}} | {{p1_task}} |
| P2 | {{p2_issue}} | {{p2_why}} | {{p2_owner}} | {{p2_effort}} | {{p2_task}} |

---

## Design Tokens Found

| Tokens | Count | Tokens | Count |
| --- | ---: | --- | ---: |
| Colors | {{count_colors}} | Radii | {{count_radii}} |
| Font families | {{count_font_families}} | Shadows | {{count_shadows}} |
| Font sizes | {{count_font_sizes}} | Gradients | {{count_gradients}} |
| Spacing values | {{count_spacing}} | CSS variables (:root) | {{count_root_vars}} |

---

## Accessibility Results

| Check | Pass / Total | Pass Rate |
| --- | --- | ---: |
| AA Normal | {{aa_normal_pass}}/{{aa_normal_total}} | {{aa_normal_pass_rate}}% |
| AA Large | {{aa_large_pass}}/{{aa_large_total}} | {{aa_large_pass_rate}}% |
| AAA Normal | {{aaa_normal_pass}}/{{aaa_normal_total}} | {{aaa_normal_pass_rate}}% |
| AAA Large | {{aaa_large_pass}}/{{aaa_large_total}} | {{aaa_large_pass_rate}}% |

**Risky pairs (<3:1):** {{pair_1}} | {{pair_2}} | {{pair_3}}

---

## Owners and Next Steps

### Developer
1. {{dev_action_1}}
2. {{dev_action_2}}
3. {{dev_action_3}}

### Designer
1. {{des_action_1}}
2. {{des_action_2}}
3. {{des_action_3}}

---

## Change Since Last Saved Snapshot

`Previous {{prev_scan_id}}` | `Consistency {{delta_consistency}}` | `Live fails {{delta_live_fails}}` | `Hardcoded {{delta_hardcoded}}` | `Status {{trend_status}}`

---

## Fix Check Plan

- Fast scope: {{retest_scope_fast}}
- Full scope: {{retest_scope_full}}
- Pass criteria:
  - live AA fails <= {{target_live_fail}}
  - AA normal pass >= {{target_aa_normal}}
  - no new P0 groups

---

<details>
<summary><strong>Technical Details (for developers and compliance checks)</strong></summary>

This section shows scan notes, issue details, and the steps to track fixes.

## A) Measurement Notes

| Section | Trust | Scan method | Notes |
| --- | --- | --- | --- |
| Token inventory | {{conf_inventory}} | {{method_inventory_short}} | {{why_inventory}} |
| Palette analysis | {{conf_palette}} | {{method_palette_short}} | {{note_palette}} |
| Live accessibility | {{conf_live}} | {{method_live_wcag_short}} | {{note_live}} |
| Hardcoded detection | {{conf_hardcoded}} | {{method_hardcoded_short}} | {{note_hardcoded}} |

## B) Accessibility Rules

| Issue set | Rule | Level | Standards risk | Notes |
| --- | --- | --- | --- | --- |
| {{group_id_1}} | {{rule_1}} | {{rule_level_1}} | {{risk_1}} | {{note_1}} |
| {{group_id_2}} | {{rule_2}} | {{rule_level_2}} | {{risk_2}} | {{note_2}} |

## C) Issue Evidence

| Issue set | Component | Selector | Page path | Image link | Steps |
| --- | --- | --- | --- | --- | --- |
| {{group_id_1}} | {{signature_1}} | {{selector_1}} | {{dom_path_1}} | {{screenshot_1}} | {{repro_1}} |

## D) Issue Groups

| Issue set | Issue type | Unique nodes | Repeats | Priority | Owner |
| --- | --- | ---: | ---: | --- | --- |
| {{group_id_1}} | {{issue_type_1}} | {{unique_1}} | {{repeated_1}} | {{priority_1}} | {{owner_1}} |
| {{group_id_2}} | {{issue_type_2}} | {{unique_2}} | {{repeated_2}} | {{priority_2}} | {{owner_2}} |

## E) Exceptions

| Exception ID | Issue set | Note | Approved by | Ends on | Status |
| --- | --- | --- | --- | --- | --- |
| {{exception_id_1}} | {{group_id_1}} | {{exception_note_1}} | {{approved_by_1}} | {{ends_on_1}} | {{status_1}} |

## F) Ticket Details

| Issue set | Jira | GitHub | Team | Target | Status |
| --- | --- | --- | --- | --- | --- |
| {{group_id_1}} | {{jira_1}} | {{gh_issue_1}} | {{team_1}} | {{sla_1}} | {{ticket_status_1}} |

## G) Note (required if metrics look conflicting)

{{contradiction_explanation}}

</details>

---

## Technical Export

```json
{
  "scan": {
    "id": "{{scan_id}}",
    "generatedAt": "{{timestamp_iso}}",
    "toolVersion": "{{tool_version}}",
    "url": "{{url}}",
    "viewport": { "width": {{viewport_width}}, "height": {{viewport_height}} },
    "themeMode": "{{theme_mode}}",
    "authState": "{{auth_state}}",
    "scope": "{{scope}}",
    "exclusions": {
      "hiddenNodes": {{exclude_hidden}},
      "disabledControls": {{exclude_disabled}},
      "decorativeText": {{exclude_decorative}}
    }
  },
  "scores": {
    "consistency": {{consistency_score}},
    "paletteAccessibility": {{palette_score}},
    "aaNormalPassRate": {{aa_normal_pass_rate}},
    "liveFailDensity": {{live_fail_density}}
  },
  "confidence": {
    "inventory": "{{conf_inventory}}",
    "palette": "{{conf_palette}}",
    "live": "{{conf_live}}",
    "hardcoded": "{{conf_hardcoded}}"
  },
  "totals": {
    "liveChecked": {{live_checked_count}},
    "liveFails": {{live_fail_count}},
    "hardcodedOccurrences": {{hardcoded_occurrences}}
  },
  "issueGroups": [
    {
      "groupId": "{{group_id_1}}",
      "signature": "{{signature_1}}",
      "selector": "{{selector_1}}",
      "type": "{{issue_type_1}}",
      "wcag": { "sc": "{{wcag_sc_1}}", "level": "{{wcag_level_1}}" },
      "priority": "{{priority_1}}",
      "uniqueNodes": {{unique_1}},
      "repeatedInstances": {{repeated_1}},
      "owner": "{{owner_1}}",
      "effort": "{{effort_1}}",
      "recommendedAction": "{{action_1}}",
      "evidence": {
        "domPath": "{{dom_path_1}}",
        "screenshotRef": "{{screenshot_1}}",
        "repro": "{{repro_1}}"
      },
      "integration": {
        "jira": "{{jira_1}}",
        "githubIssue": "{{gh_issue_1}}",
        "team": "{{team_1}}",
        "slaTarget": "{{sla_1}}",
        "ticketStatus": "{{ticket_status_1}}"
      }
    }
  ],
  "topFixes": [
    {
      "rank": 1,
      "component": "{{component_1}}",
      "issueGroupId": "{{group_id_1}}",
      "userImpact": "{{impact_1}}",
      "severity": "{{sev_1}}",
      "effort": "{{effort_1}}",
      "owner": "{{owner_1}}",
      "expectedLift": "{{lift_1}}"
    }
  ],
  "waivers": [
    {
      "waiverId": "{{waiver_id_1}}",
      "groupId": "{{group_id_1}}",
      "reason": "{{waiver_reason_1}}",
      "approvedBy": "{{waiver_owner_1}}",
      "expiresOn": "{{waiver_expiry_1}}",
      "status": "{{waiver_status_1}}"
    }
  ],
  "trend": {
    "previousScanId": "{{prev_scan_id}}",
    "delta": {
      "consistency": "{{delta_consistency}}",
      "liveFails": "{{delta_live_fails}}",
      "hardcoded": "{{delta_hardcoded}}"
    }
  }
}
```

---

## Authoring Rules (keep it short and visual)

1. Keep top section under one screen.
2. Put only high-impact items in top tables.
3. Move technical detail into the collapsible block.
4. Use grouped issue counts in headlines, not raw repeated counts.
5. Add one note whenever key metrics seem inconsistent.
