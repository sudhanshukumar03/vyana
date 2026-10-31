# Documentation

| Guide | Use it for |
| --- | --- |
| [Setup](SETUP.md) | Start Compose, develop locally or connect the simulator |
| [Features and limits](FEATURES.md) | Understand what the app does and where its boundaries are |
| [Architecture](ARCHITECTURE.md) | Follow data flow, ownership and storage |
| [API](API.md) | Build against HTTP, socket and private AI contracts |
| [Google Health activity](GOOGLE_HEALTH.md) | Configure read-only phone/tracker steps and distance through web OAuth |
| [Operations](OPERATIONS.md) | Upgrade, import, back up, restore and retain data |
| [Testing](TESTING.md) | Run checks safely and reproduce rehearsals |
| [Demo](DEMO.md) | Present a repeatable synthetic demonstration |
| [Recorded reference datasets](../datasets/README.md) | Inspect public ECG/PPG recordings separately from live hardware and SOS |
| [Research bibliography](research/literature-bibliography-2026-10-28.md) | Find publications relevant to the project and its sensors |
| [Hardware](../hardware/README.md) | Build firmware and prepare the deferred physical bench |

The [24 October audit](audit/2026-10-24.md) records the original problems. The [remediation plan](audit/PLAN.md) defines completion, and the [status ledger](audit/STATUS.md) records evidence and pending checks. These dated records are distinct from the current behavior described in the guides above.

The [weight-management and activity review plan](ACTIVITY_HEALTH_REVIEW_PLAN.md) records the implemented core of background imports, age/lifestyle-aware maintenance estimates, BMI/reference weight, structured goals, weekly comparisons, timestamp matches and educational benefits, plus later goal-specific intake/projection policy work. No daily check-in is included.

Contributors should start with [CONTRIBUTING.md](../CONTRIBUTING.md).

The [software-first checklist](audit/software-first-2026-10-29.md) separates completed local repairs from external account setup and sensor-dependent verification.

The [30 October scope audit](audit/scope-cleanup-2026-10-30.md) lists obsolete motion code, redundant or optional features, and unfinished work that can proceed without connected sensors.

The [required-software follow-up](audit/required-software-2026-10-30.md) records the implemented Google-only activity, raw ECG stream/display, simplified controls and remaining real-account/hardware checks. Use the [exhibition procedure](DEMO.md) for the current laptop-based setup.

The [28 October live-only recovery](audit/live-only-recovery-2026-10-28.md) records the simulated-display correction and the physical verification still required.

The [Vyana design references](research/VYANA_DESIGN_REFERENCES.md) document the five public health-product references, shared palette and typography, component decisions and UI verification scope.
