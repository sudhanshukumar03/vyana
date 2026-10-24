# Contributing

Use Node 24.22.1 or newer within 24.x, pnpm 11.18.0 and Python 3.12. Work with synthetic data and preserve existing changes.

```powershell
pnpm install --frozen-lockfile
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r ai/requirements-test.lock
```

On Linux/macOS, activate with `source .venv/bin/activate`. Follow [setup](docs/SETUP.md) to run the services and [testing](docs/TESTING.md) to configure a disposable database before running `pnpm verify`.

Add behavioral regression coverage when fixing a defect. Check the affected API, UI and producer contracts together. Keep deployed SQL migrations unchanged; add a new version and rehearse upgrades on a copy.

Maintain one root pnpm lockfile. Python locks are generated with pip-tools and hashes from `ai/pyproject.toml`; install them with `--require-hashes`. Never commit environment files, credentials, personal reports, virtual environments or generated output.

CI runs software, database, browser, firmware and secret checks. Gitleaks exceptions must match specific non-secret values or source fingerprints; do not exclude whole test files. Record actual outcomes in [the audit status](docs/audit/STATUS.md), keeping historical measurements dated.
