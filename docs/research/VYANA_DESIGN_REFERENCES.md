# Vyana design references and implementation

Reviewed 30 October 2026. This is a curated shortlist for a personal health dashboard, not an objective worldwide website ranking. Public product pages, official app documentation and available imagery were reviewed; no private competitor dashboards were accessed. WHOOP's homepage blocked automated visual access. Withings' homepage rendering was incomplete in the screenshot run, so its official app page, documentation and public product imagery were used instead.

## Five references

| Reference | Useful principle | Applied in Vyana |
| --- | --- | --- |
| [Oura](https://ouraring.com/) and [app organization](https://support.ouraring.com/hc/en-us/articles/360058599753-How-to-Use-the-Oura-App) | Separate an overview from detailed measurements and longer trends | One overview lead, readable snapshot, details on their own routes; compact review links |
| [WHOOP](https://www.whoop.com/us/en/) and [Health Monitor](https://support.whoop.com/s/article/WHOOP-Health-Monitor-Report?language=en_US) | High-contrast metrics and clear measurement/status hierarchy | Ink overview, large measured values, separate units, source/freshness and explicit unavailable states |
| [Withings App](https://www.withings.com/en-us/pages/withings-app) | Measurements paired with understandable history | Thin weight trend, exact record access, compact supporting metrics and consistent chart surfaces |
| [Levels](https://www.levels.com/) | Confident sans-serif type and plain-language context beside data | Manrope headings, DM Sans body, measured spacing and concise supporting explanations |
| [Function Health](https://www.functionhealth.com/) | Restrained navigation and progressive disclosure | Contextual toolbar, grouped navigation, focused dialogs and optional detail disclosures |

The references inform hierarchy, spacing and component roles. Their logos, imagery, proprietary components and health claims are not copied into the product.

## Host inspection

| Concern | Observed host evidence |
| --- | --- |
| Framework | React 19, TypeScript and Vite 6 — `apps/web/package.json` |
| Routes | React Router 7, eleven signed-in routes — `apps/web/src/App.tsx` |
| Components | Existing native `Modal`, `PageHeader`, `Sidebar`, `MetricRow`, `TrendsChart`, health review and forms — `apps/web/src/components/` |
| Tokens/theme | Tailwind 4 `@theme` in `apps/web/src/index.css`; shared visual layer in `apps/web/src/premium.css`; feature/layout CSS in `apps/web/src/app.css` |
| Dependencies | Recharts 2, Lucide React, Zustand 5 and Socket.IO client — `apps/web/package.json` |
| Registry | None selected; existing native interactions fit this task. No Motion Lexicon registry component or runtime dependency added |

## Page plan and visual decisions

The job is to help a signed-in person inspect their available readings and activity, then explore context or manage a specific task. Use a light data workspace and dark navigation/overview, rather than applying a marketing landing-page layout to every route.

| Region | Component/source | Registry ID | State boundary |
| --- | --- | --- | --- |
| Navigation and toolbar | Existing Sidebar/Header/Layout | none | Route selection, mobile drawer and notifications |
| Overview | HealthOverview/HealthOrbit | none | Links to real Wellness and Vitals routes; decorative orbit is never a score |
| Snapshot and charts | Existing MetricRow/TrendsChart | none | Missing, physical, stale, critical and explicit display-preview data |
| Activity and weight | Existing ActivityTimeline/HealthReview/WeightEnergyReview | none | Owner/source/profile changes, imports, setup and voluntary measurements |
| Reports and assistant | Existing Reports/Assistant | none | Upload, pending, failure, fallback, cancellation and retry |
| Profile/settings/emergency | Existing task components and native Modal | none | Form saves, consent, device selection/revocation and SOS confirmation/cancellation |

Palette: mineral canvas `#F4F6FA`, white `#FFFFFF`, ink rail `#182633`, cobalt action `#345CCE`, sage `#EAF3EE`, lilac `#EFEDF8`; apricot `#FBEFE4` is limited to energy/temperature accents. Semantic warning/critical colours remain independent of decorative accents.

Typography: locally hosted variable Manrope for headings and data values; locally hosted variable DM Sans for body and controls. Latin font files total approximately 61 KB. SIL Open Font License files ship in `apps/web/public/fonts/`. No runtime Google Fonts request is needed. System fonts remain fallbacks.

Layout: left-aligned content, grouped ink navigation, a contextual top toolbar, one expressive overview and quieter measurement/task surfaces. Breakpoints preserve the existing 320/390/768/1440 px acceptance sizes. Data views deliberately use a light theme even under an OS dark preference; the ink rail and energy panel provide controlled contrast. There is no newly advertised dark-mode toggle.

Motion: the primary moment is opening mobile navigation (240 ms transform/opacity). Dialog arrival is a supporting moment; short colour/focus changes provide control feedback. Reduced motion removes arrival animation. Charts and the new abstract orbit remain static. Backdrop blur is limited to transient dialogs, with a solid data surface beneath.

## Feature-review findings

- Profile and BMI previously used different age calculations. Both now use the profile-local calendar birthday and the same age-20 boundary; tests cover the birthday across timezones and invalid/future inputs.
- The health-review hook now subscribes to the fields it needs instead of the entire store. Existing account/source/profile epoch and abort guards remain in place.
- History export and report-upload accessible names were inconsistent with their visible labels. The export name now contains the visible text; upload uses its visible label and file-format description.
- History now displays its page number alongside the loaded count, so pagination has a visible location indicator.
- Native checkbox/radio semantics are preserved, with 44 px input hit areas and small visual marks. Inline SOS navigation links have explicit touch targets.
- Sensor controls remain available on sensor-related pages and whenever preview is enabled. Independent software pages avoid irrelevant hardware notices. Backend failures and global SOS remain visible.
- Decorative graphics do not fabricate a waveform or clinical score. Explicit missing/zero distinctions, original records, source-reported activity types and eligibility restrictions remain part of the underlying product.

## Verification

Results and final screenshots are recorded after the full checks in the [30 October software audit](../audit/required-software-2026-10-30.md). Browser fixtures contain synthetic records and must not be represented as the owner's measured health information. Hardware quality, external notification receipt and clinical validation remain separate from software checks.
