# Google Health web activity checkpoint - 29 October 2026

## Implemented locally

- Read-only Google Health web OAuth with PKCE, one-use session-bound state, an HttpOnly callback cookie and encrypted owner-bound access/refresh tokens. Credentials remain server-side.
- Account-owned seven-day steps/distance cache, profile timezone grouping, automatic synchronization while Vyana is open, refresh-token handling, bounded requests, cooldown and safe disconnect during an in-flight sync.
- Activity page retains its earlier four metric cards and Recent Steps Trend layout, with a compact Google connection row and expandable accessible records table. The large promotional activity banner was removed after user feedback. Dashboard and API summary use linked cloud activity independently of ESP32 connectivity. Missing data remains unavailable; recorded zero remains zero. Calories and active minutes are not estimated.
- MPU6050 driver, simulated steps and firmware activity publishing removed from source. ESP32 vitals/input-summary transport remains independent. No new board flash or serial interaction occurred during this integration work.
- Setup instructions: [Google Health guide](../GOOGLE_HEALTH.md).

## Verification

- API: 10 suites, 89 tests pass, including 13 Google Health boundary/integration tests. Disposable `healthguard_google_test` database only; normal account data was not reset.
- Web unit tests: 6 files, 60 tests pass, including independent cloud activity and stale-response/disconnect guards.
- Browser: 6 targeted checks pass for unconfigured/available connection states, synthetic connected activity, disconnect, 320/390/768/1440 px layouts, 44 px controls and existing socket/poll equipment updates. Screenshots inspected at desktop and narrow widths. Provider responses in these checks are mocked, not real account activity.
- API compilation, frontend type check and production build pass. Native firmware: 62 tests pass and `esp32dev` build succeeds. Firmware count excludes removed simulation-only tests.
- No Google account was linked and no real provider data was imported by these tests. No billing account was activated or payment details entered.

## Remaining external setup

Google Health API is now enabled in the user's Cloud project. Vyana is registered in external testing mode, with the confirmed account as its only test user. OpenID, email and read-only activity scopes were saved; profile scope was verified unchecked. The Web OAuth client uses the exact localhost callback, its downloaded configuration is stored privately, and the API was restarted. A normal synthetic demo-account login confirmed the running API returns `configured: true`. User-account consent and the first real import remain unverified.

The reported page was generic Cloud signup/billing. It does not establish an API-specific billing requirement. Google Fit mobile sign-in alone does not satisfy the Google Health linked-profile requirement. MobileTrack or a compatible synced tracker must supply records. See the official sources linked in the setup guide.

Brave inspection confirmed the signed-in account is `sksingh032003@gmail.com`. The initial API library request redirected to `/enable-mfa`; after the user completed two-step verification, Cloud access was restored and the setup above succeeded. No account security settings or payment setup were submitted by the assistant. Browser automation later stopped because it could not verify the Vyana tab's URL, so the real connection flow was not completed.

The Activity layout restoration passed frontend type checking/lint and all six targeted browser checks. Desktop and 320 px screenshots were inspected; the responsive checks also cover 390, 768 and 1440 px widths. No other product page layout was changed by this restoration.

The sensor-only firmware is compiled but not uploaded to the current board. A later USB upload requires the electrode pads off-body. Real ECG waveform streaming remains a separate outstanding task.
