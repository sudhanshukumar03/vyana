param([switch]$NoBrowser, [switch]$SkipHotspot)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskRuntime = Join-Path $taskRoot '.audit-runtime/vyana-startup'

function Test-VyanaDocker([string]$Executable) {
    # Windows PowerShell turns redirected native stderr into terminating errors
    # under Stop. A stopped daemon is an expected false result, not an exception.
    $taskPriorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Executable info --format '{{.ServerVersion}}' *> $null
        return $LASTEXITCODE -eq 0
    } finally { $ErrorActionPreference = $taskPriorPreference }
}

function Test-VyanaService([string]$Url, [string]$ExpectedStatus = '') {
    try {
        $taskResponse = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        if ($taskResponse.StatusCode -ne 200) { return $false }
        if ($ExpectedStatus) { return ($taskResponse.Content | ConvertFrom-Json).status -eq $ExpectedStatus }
        return $taskResponse.Content -match '(?is)<title>\s*Vyana(?:\s|<)'
    } catch { return $false }
}

function Start-SavedHardwareHotspot {
    # Reuse the existing hotspot only. Never change its SSID or password.
    $taskConfigFile = Join-Path $taskRoot 'hardware/esp32/src/config.h'
    if (-not (Test-Path -LiteralPath $taskConfigFile)) { return }
    $taskMatch = [regex]::Match([IO.File]::ReadAllText($taskConfigFile), 'WIFI_SSID\s*=\s*"([^"\r\n]+)"')
    if (-not $taskMatch.Success) { return }
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $null = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]
        $null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
        $null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]
        $taskProfile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
        if (-not $taskProfile) { throw 'No network connection is available.' }
        $taskManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]::CreateFromConnectionProfile($taskProfile)
        if ($taskManager.GetCurrentAccessPointConfiguration().Ssid -ne $taskMatch.Groups[1].Value) { return }
        if ($taskManager.TetheringOperationalState.ToString() -eq 'On') { return }
        $taskAwait = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and
            $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
        } | Select-Object -First 1
        $taskOperation = $taskManager.StartTetheringAsync()
        $taskResult = $taskAwait.MakeGenericMethod([Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult]).Invoke($null, @($taskOperation)).GetAwaiter().GetResult()
        if ($taskResult.Status.ToString() -ne 'Success') { throw ('Hotspot status: ' + $taskResult.Status) }
        Write-Host 'Enabled the saved ESP32 hotspot.'
    } catch { Write-Warning ('Enable your saved hardware Wi-Fi network if needed. ' + $_.Exception.Message) }
}

function Test-VyanaOwnedProcess($Process, $State, [string]$CommandLine) {
    if (-not $Process -or -not $State -or $Process.Id -ne $State.pid) { return $false }
    if ($Process.StartTime.ToUniversalTime().ToString('o') -ne $State.started) { return $false }
    $taskWrapper = Join-Path $PSScriptRoot 'with-node.ps1'
    return $Process.ProcessName -eq 'powershell' -and $CommandLine.Contains($taskWrapper) -and $CommandLine -match '\bpnpm\s+dev\b'
}

function Stop-VyanaOwnedServices {
    $taskStateFile = Join-Path $taskRuntime 'services.json'
    if (-not (Test-Path -LiteralPath $taskStateFile)) { return $false }
    try {
        $taskState = Get-Content -LiteralPath $taskStateFile -Raw | ConvertFrom-Json
        $taskOwned = Get-Process -Id $taskState.pid -ErrorAction SilentlyContinue
        $taskInfo = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$taskState.pid)
        if (-not (Test-VyanaOwnedProcess $taskOwned $taskState ([string]$taskInfo.CommandLine))) { return $false }
        & taskkill.exe /PID $taskOwned.Id /T /F *> $null
        if ($LASTEXITCODE -ne 0) { return $false }
        Write-Host 'Stopped unhealthy services owned by this Vyana launcher; restarting them.'
        return $true
    } catch { return $false }
}

function Start-Vyana {
    $null = New-Item -ItemType Directory -Path $taskRuntime -Force
    $taskLock = [IO.File]::Open((Join-Path $taskRuntime 'startup.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    try {
        if (-not $SkipHotspot) { Start-SavedHardwareHotspot }
        $taskApiReady = Test-VyanaService 'http://127.0.0.1:8000/health/ready' 'ready'
        $taskWebReady = Test-VyanaService 'http://localhost:5173'
        if (-not ($taskApiReady -and $taskWebReady)) {
            if ($taskApiReady -or $taskWebReady) {
                if (-not (Stop-VyanaOwnedServices)) { throw 'A partial Vyana instance is not owned by this launcher. Close its old dev terminal, then launch again.' }
                Start-Sleep -Seconds 1
                if ((Test-VyanaService 'http://127.0.0.1:8000/health/ready' 'ready') -or (Test-VyanaService 'http://localhost:5173')) {
                    throw 'A different process is still using a Vyana port. Close that instance before restarting.'
                }
            }
            foreach ($taskFile in @('.env', 'apps/api/.env', 'ai/.env', 'node_modules')) {
                if (-not (Test-Path -LiteralPath (Join-Path $taskRoot $taskFile))) {
                    throw ('Initial setup is incomplete: missing ' + $taskFile + '. See docs/SETUP.md.')
                }
            }
            $taskDocker = (Get-Command docker -ErrorAction Stop).Source
            if (-not (Test-VyanaDocker $taskDocker)) {
                $taskDesktop = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/Docker Desktop.exe'
                if (-not (Test-Path -LiteralPath $taskDesktop)) { $taskDesktop = Join-Path $env:ProgramFiles 'Docker/Docker/Docker Desktop.exe' }
                if (-not (Test-Path -LiteralPath $taskDesktop)) { throw 'Start Docker Desktop, then launch Vyana again.' }
                Start-Process -FilePath $taskDesktop -WindowStyle Hidden
                Write-Host 'Waiting for Docker Desktop...'
                $taskDeadline = [DateTime]::UtcNow.AddSeconds(120)
                do {
                    Start-Sleep -Seconds 2
                    if (Test-VyanaDocker $taskDocker) { break }
                    if ([DateTime]::UtcNow -gt $taskDeadline) { throw 'Docker Desktop did not become ready within two minutes.' }
                } while ($true)
            }
            Push-Location $taskRoot
            try {
                Write-Host 'Starting the existing Vyana database...'
                & $taskDocker compose up -d --wait db
                if ($LASTEXITCODE -ne 0) { throw 'The Vyana database could not start.' }
            } finally { Pop-Location }
            $taskStateFile = Join-Path $taskRuntime 'services.json'
            if (Test-Path -LiteralPath $taskStateFile) {
                $taskState = Get-Content -LiteralPath $taskStateFile -Raw | ConvertFrom-Json
                $taskExisting = Get-Process -Id $taskState.pid -ErrorAction SilentlyContinue
                if ($taskExisting -and $taskExisting.StartTime.ToUniversalTime().ToString('o') -eq $taskState.started) {
                    if (-not (Stop-VyanaOwnedServices)) { throw 'The existing process could not be verified as this Vyana launcher. Check .audit-runtime/vyana-startup/services.err.log.' }
                    Start-Sleep -Seconds 1
                }
            }
            $taskWrapper = Join-Path $PSScriptRoot 'with-node.ps1'
            $taskProcess = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru -WorkingDirectory $taskRoot `
                -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $taskWrapper + '"'), 'pnpm', 'dev') `
                -RedirectStandardOutput (Join-Path $taskRuntime 'services.out.log') `
                -RedirectStandardError (Join-Path $taskRuntime 'services.err.log')
            @{pid=$taskProcess.Id; started=$taskProcess.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $taskStateFile
            Write-Host 'Starting the dashboard, API and AI service...'
            $taskDeadline = [DateTime]::UtcNow.AddSeconds(120)
            do {
                if ($taskProcess.HasExited) { throw 'Vyana stopped during startup. See .audit-runtime/vyana-startup/services.err.log.' }
                if ((Test-VyanaService 'http://127.0.0.1:8000/health/ready' 'ready') -and (Test-VyanaService 'http://localhost:5173')) { break }
                if ([DateTime]::UtcNow -gt $taskDeadline) { throw 'Vyana is not ready yet. Check .audit-runtime/vyana-startup/services.err.log.' }
                Start-Sleep -Seconds 1
            } while ($true)
        }
        Write-Host 'Vyana is ready at http://localhost:5173. Powered ESP32 devices with the full firmware upload automatically.'
        if (-not $NoBrowser) { Start-Process 'http://localhost:5173' }
    } finally { $taskLock.Dispose() }
}

if ($MyInvocation.InvocationName -ne '.') {
    try { Start-Vyana } catch { Write-Host ('Vyana startup: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }
}
