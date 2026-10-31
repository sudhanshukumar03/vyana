# Vyana interface refinement

The second design pass makes the dashboard a working health overview. It keeps Vyana's existing visual identity and reduces elements that compete with the measurements.

## Reference review through MCP

Official public pages and app documentation were revisited using the MCP web tool. These are references for specific interface decisions, not a ranking or an audit of private competitor accounts.

| Reference | Observed pattern | Vyana decision |
| --- | --- | --- |
| [Oura app design](https://ouraring.com/blog/new-oura-app-experience/) | Daily highlights, a dedicated vitals view and longer-term health views | A compact daily overview; raw ECG and display controls belong in Vitals |
| [WHOOP home](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/) | Key measurements first, deeper metrics in their own sections | Prioritize readings over decorative introductions; avoid duplicate metric cards |
| [Withings app](https://support.withings.com/hc/en-us/articles/202719068-Withings-App-Android-What-is-the-Withings-App-and-what-does-it-do) | Measurements alongside history and contextual insights | Keep a trend, device status and a short recorded health review |
| [Levels](https://www.levels.com/) | Clearly separated data/context and plain supporting explanations | Shorter copy and clear next steps when activity is not connected |
| [Function Health](https://www.functionhealth.com/) | Distinct stages for results, explanation and action | Avoid repeating guidance and explanations across every dashboard panel |

Oura's app landing page was unreadable through the tool, WHOOP's support app page returned a CSS error and an old Withings landing URL redirected to a contact page. The accessible official pages above were used instead. WHOOP and Levels linked product imagery was opened through MCP as supporting reference. No competitor assets or health claims were copied.

## Visual plan

Palette: mineral `#f4f6fa`, white `#ffffff`, ink `#182633`, cobalt `#345cce`, sage `#eaf3ee`, and muted text `#5e6b7d`. Manrope remains the heading/number face; DM Sans remains the reading face. Semantic warning and critical colors remain reserved for data states.

Desktop layout:

```text
navigation | date                         notifications / SOS / account
           | greeting + compact page title               health review
           | latest readings: five concise measurement panels
           | recent readings chart        device + recent alerts
           | brief recorded health review
```

On phones, navigation, brand and essential actions share one header row. Data panels wrap without shrinking controls below 44px. The disconnected Activity view provides one explanatory connection prompt instead of displaying an empty dial, three unavailable metrics and a second empty chart card.

No new component runtime or animation dependency is needed. Existing navigation, notification dismissal, native dialogs, form validation and reduced-motion behavior are retained. Sensor data, Google imports, calculation rules and alert delivery are unchanged.

## Changes

- Replace the large decorative dashboard hero with a compact heading; remove its unused orbit component.
- Remove dashboard duplicates of the wellness score, movement totals and ECG panel. They remain on the relevant detailed routes.
- Remove repeated toolbar breadcrumbs and relocate sign-out beside the sidebar account.
- Remove repeated decorative page-heading icons and the redundant Wellness badge.
- Make display controls available in Vitals and Settings, with an explicit persistent indicator on sensor pages when preview is enabled.
- Make no-data states smaller and remove the unused sensor/activity overlap panel when there are no matches.
- Keep source labels, missing values, import errors, critical readings and consent controls visible where they matter.

Validation results are recorded in `.audit-runtime/ui-polish/`.

## Acceptance

- Production build and frontend lint passed.
- All 77 frontend unit tests passed.
- All 52 unique browser scenarios passed across the completed batches, including the two updated assertions for the Settings display section and demo reset on the Vitals route.
- All eleven signed-in routes were checked at 320, 390, 768 and 1440 pixels, with no viewport overflow or visible controls smaller than 44px.
- Automated checks covered serious/critical accessibility findings, notification focus restoration, OS dark preference with the supported light theme, reduced motion, local fonts, profile dialogs, mobile sign-out, Google activity states, sensor updates, raw ECG export, reports and SOS controls.

Screenshots: `.audit-runtime/ui-polish/acceptance/`.
Machine-readable acceptance: `.audit-runtime/ui-polish/validation.json`.

The tests use disposable accounts and synthetic records. These UI checks do not validate physical sensor accuracy or real notification receipt.
