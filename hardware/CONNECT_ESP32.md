# Connect an ESP32 to the local app

The data path is ESP32 -> Wi-Fi -> API on the PC -> dashboard. USB is used to upload firmware and for electrodes-off serial testing. MAX30102, DS18B20 and AD8232 use real acquisition. Activity is imported separately through Google Health; the ESP32 has no activity driver or step simulation.

The dashboard starts in **Live readings only** after every reload, regardless of old saved preview settings. Missing or stale current readings stay unavailable. **Enable simulated demo** explicitly enables labelled generated displays for that page session; it is not proof of working sensors.

After standalone sensor troubleshooting, upload **esp32dev** again. The `max30102_bench`, `ad8232_bench` and `ad8232_wifi_bench` sketches do not send measurements to the Vyana API. The full firmware identifies itself with `VYANA_SENSOR_HUB` at boot. Start with one sensor and confirm its own serial result, HTTP delivery and fresh dashboard value before connecting the others. A temperature-only equipment update can appear without heart rate or SpO2.

## Everyday automatic operation

After the one-time configuration and `esp32dev` upload, the board automatically joins its configured Wi-Fi and publishes equipment/available readings every five seconds. It retries Wi-Fi and temporary API failures without commands or an assistant. Its offline queue is bounded in RAM; prolonged outages can drop readings and a power loss clears that queue.

On this Windows development setup, double-click **Start Vyana.cmd** in the project folder. It starts Docker Desktop if needed, starts the existing database, launches the API/web/AI services in the background and opens http://localhost:5173. A second launch reuses ready services. If the ESP32 uses the PC's saved hotspot, the launcher attempts to enable it without changing its name/password. Otherwise keep the configured Wi-Fi network available. Initial dependencies and environment setup are still required; the launcher does not provision devices or flash firmware.

Keep the PC awake with Vyana running, power the configured ESP32 and open the dashboard signed into the device owner's account. No repeated uploads, data-copy commands or refresh clicks are needed. The board sends directly to the API even when the browser is closed. The browser uses live socket events, polls every five seconds if that connection is unavailable, and catches up when the network returns or the tab regains focus. With a working socket it reconciles through REST every 30 seconds. Missing/invalid sensor channels remain unavailable.

Background startup logs are under `.audit-runtime/vyana-startup/`. The local API address must remain reachable from the board. Changes to Wi-Fi credentials, server address or device credentials require updating the private firmware configuration and uploading it once again. A hosted always-on backend is needed to operate independently of this PC; this launcher does not deploy one.

## 1. Make the API reachable

Connect the PC and ESP32 to the same trusted local network. Use a 2.4 GHz Wi-Fi network for this ESP32 board. In `apps/api/.env`, set:

```dotenv
HOST=0.0.0.0
PORT=8000
WEB_ORIGIN=http://localhost:5173
```

Stop the current dev command with Ctrl+C, then run `pnpm run dev` from the project root. Keep the browser at `http://localhost:5173`; the ESP32 connects directly to API port 8000. Allow inbound TCP port 8000 for the device on the Windows Private network profile if blocked. Router guest/client isolation can also prevent communication between devices.

Find the PC's active Wi-Fi/Ethernet IPv4 address with `ipconfig`. During preparation it was detected as `192.168.29.32`; confirm it before use because DHCP can change it. From another device on that network, opening `http://192.168.29.32:8000/health/ready` should return `{"status":"ready"}`. Resolve reachability before uploading firmware.

## 2. Register and select the ESP32

Create/sign in to your Vyana account first. In **Settings > Your devices**, create the ESP32 and save its one-time credential privately, then select it as the active source. Provision only once for this board. Alternatively, run this in a private PowerShell terminal on the PC; enter your Vyana email/password in the credential prompt:

```powershell
$base = 'http://localhost:8000/api/v1'
$account = Get-Credential -Message 'Enter your Vyana email and password'
$body = @{ email=$account.UserName; password=$account.GetNetworkCredential().Password } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $body
$headers = @{ Authorization="Bearer $($login.token)" }
$device = Invoke-RestMethod -Method Post -Uri "$base/devices" -Headers $headers -ContentType 'application/json' -Body '{"name":"ESP32 prototype"}'
Invoke-RestMethod -Method Post -Uri "$base/devices/$($device.id)/activate" -Headers $headers
$device.credential
```

Save the last value privately as `DEVICE_KEY`. It is shown only at creation; do not paste it into chat or commit it. Activation selects this device for the dashboard, including when an old simulator device already exists. Run provisioning once for this board, rather than creating a new device on every boot.

## 3. Configure firmware

Copy `hardware/esp32/src/config.example.h` to `hardware/esp32/src/config.h` if that private file does not already exist. Replace its existing settings:

```cpp
constexpr const char* WIFI_SSID = "YOUR_WIFI_NAME";
constexpr const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
constexpr const char* API_BASE = "http://192.168.29.32:8000/api/v1";
constexpr const char* DEVICE_KEY = "YOUR_NEW_DEVICE_CREDENTIAL";
constexpr const char* ROOT_CA = "";
constexpr bool ALLOW_INSECURE_HTTP = true; // Trusted local bench test only.
```

Use your current PC address. `localhost` in ESP32 firmware refers to the ESP32 itself. For an HTTPS deployment, configure its root CA and keep `ALLOW_INSECURE_HTTP=false`. These local HTTP settings are for bench development.

## 4. Wire, build and upload

Follow the [photographed-board wiring guide](wiring/esp32-current-code/README.md) for MAX30102, DS18B20 and AD8232. Phone activity uses Google Health and needs no motion sensor wiring. Keep ECG electrodes off the body while connected to computer USB; follow the wiring guide's standalone-battery procedure before body-connected use.

In VS Code with the official PlatformIO IDE extension, use **File > Open Workspace from File** and select [esp32.code-workspace](esp32.code-workspace). This opens `hardware/esp32` as the PlatformIO project root. The default is **esp32dev** for all-sensor Vyana operation. Select **max30102_bench** explicitly only for temporary MAX-only USB troubleshooting; `native` is only for host tests. Use the chosen environment's Build and Upload, or run these full-Vyana commands in a PlatformIO terminal from the repository root:

```powershell
pio device list
pio run --project-dir hardware/esp32 --environment esp32dev --jobs 2
pio run --project-dir hardware/esp32 --environment esp32dev --target upload --upload-port COM5
pio device monitor --port COM5 --baud 115200
```

Replace COM5 with your board's actual port. Use a USB data cable. PlatformIO supports build/upload/serial monitoring directly in VS Code: [official instructions](https://docs.platformio.org/en/latest/integration/ide/vscode.html).

If VS Code reports `#include errors detected` or asks to update `includePath`, let PlatformIO finish loading/installing dependencies, then run **PlatformIO: Rebuild IntelliSense Index** from Ctrl+Shift+P. Run **Developer: Reload Window** if the newly installed extension is not active yet. PlatformIO generates the compiler, framework and library paths; avoid manually adding host-test mock headers or disabling diagnostics. Use PlatformIO **Build**, rather than the generic C/C++ Runner or Code Runner, for this firmware.

If the missing header is `WProgram.h` through OneWire/DS18B20, check that IntelliSense is using the ESP32 configuration. OneWire selects that legacy header when the build's `ARDUINO` definition is missing. A repository-root MinGW configuration can cause this even when the firmware builds successfully. Open the firmware workspace above, or generate the ESP32 compilation database with `pio run --project-dir hardware/esp32 --environment esp32dev --target compiledb` and point the repository-root C/C++ configuration's `compileCommands` setting at `${workspaceFolder}/hardware/esp32/compile_commands.json`. Regenerate it after changing the board, libraries or build flags, then reload VS Code.

For SDK headers such as `esp_netif_types.h` or `soc/soc_caps.h`, `scripts/sdk_intellisense.py` exposes the installed SDK's response-file include paths in PlatformIO's IDE metadata and expands them when generating `compile_commands.json`. Keep the `extra_scripts` setting in `platformio.ini`. Rebuild the IntelliSense index and regenerate the compilation database after updating the SDK; a firmware build alone does not refresh the database.

## 5. Confirm delivery

After Wi-Fi and UTC synchronization, the firmware queues heartbeat/equipment and any complete valid vitals approximately every five seconds. It does not generate or upload activity; steps and distance come from Google Health. Serial `delivery=200` indicates an accepted API request, not that a sensor produced a usable measurement. Confirm the sensor's fresh, non-null equipment value on the automatically updating dashboard under the account used to create the device.

| Observation | Check |
|---|---|
| No delivery / negative HTTP result | Wi-Fi, PC address, API binding, firewall and network isolation |
| `delivery=401` | The device credential is missing, wrong or revoked |
| Clock unsynchronized | Allow the board to reach its configured Internet time servers. On a trusted HTTP bench only, the explicit `#define BENCH_HTTP_CLOCK_FROM_API 1` opt-in can initialize an unset clock from the API Date header when `ALLOW_INSECURE_HTTP=true`; it is disabled by default |
| Vitals absent | Fresh probe temperature and ECG input summary appear through device equipment even without optical data; complete vital history still requires valid optical and temperature readings. Generated demo steps are hidden in live-only mode |
| Data arrives but dashboard shows another source | Use the activation request above for this device |

MAX30102 needs stable contact and a fresh four-second acquisition window. AD8232 connected leads remain `Unknown` because rhythm classification is unimplemented. Health Vitals shows ADC/count summaries; a clipped input is not a usable ECG. The newly compiled full firmware also uploads bounded raw sample batches for a recorded ADC chart, with loss/lead-off/restart gaps. It must still be uploaded with electrodes off-body and physically verified. The explicit simulated demo trace remains separate. See the [physical sensor check](../docs/audit/esp32-live-sensors-2026-10-27.md) for the earlier observed board state.
