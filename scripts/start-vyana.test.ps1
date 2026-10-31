$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'start-vyana.ps1')
$script:taskResponse = @{StatusCode=200; Content='{"status":"ready"}'}
function Invoke-WebRequest { param($Uri, [switch]$UseBasicParsing, $TimeoutSec) return $script:taskResponse }
if (-not (Test-VyanaService 'http://test/health/ready' 'ready')) { throw 'Ready API was rejected.' }
$script:taskResponse = @{StatusCode=200; Content='{"status":"starting"}'}
if (Test-VyanaService 'http://test/health/ready' 'ready') { throw 'Unready API was accepted.' }
$script:taskResponse = @{StatusCode=200; Content='<html><title>Vyana - Your vitals. In sync.</title></html>'}
if (-not (Test-VyanaService 'http://test')) { throw 'Vyana dashboard was rejected.' }
$script:taskResponse = @{StatusCode=200; Content='<html><title>Other application</title></html>'}
if (Test-VyanaService 'http://test') { throw 'An unrelated application was accepted.' }
$script:taskResponse = @{StatusCode=503; Content='{"status":"ready"}'}
if (Test-VyanaService 'http://test/health/ready' 'ready') { throw 'Failed API was accepted.' }
function Invoke-WebRequest { param($Uri, [switch]$UseBasicParsing, $TimeoutSec) throw 'Connection refused' }
if (Test-VyanaService 'http://test') { throw 'An unreachable service was accepted.' }
Write-Output 'All six Vyana startup readiness checks passed.'
$taskTestDirectory = Join-Path $taskRuntime ('test-' + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $taskTestDirectory -Force
$taskNativeFixture = Join-Path $taskTestDirectory 'docker-fixture.cmd'
try {
    [IO.File]::WriteAllText($taskNativeFixture, "@echo off`r`necho Synthetic unavailable daemon 1>&2`r`nexit /b 1`r`n")
    if (Test-VyanaDocker $taskNativeFixture) { throw 'Stopped Docker was accepted.' }
    if ($ErrorActionPreference -ne 'Stop') { throw 'Native probe changed the caller error preference.' }
    [IO.File]::WriteAllText($taskNativeFixture, "@echo off`r`necho Synthetic diagnostic 1>&2`r`necho fixture-version`r`nexit /b 0`r`n")
    if (-not (Test-VyanaDocker $taskNativeFixture)) { throw 'Running Docker was rejected because of stderr output.' }
    Write-Output 'Both native Docker readiness checks passed.'
} finally {
    Remove-Item -LiteralPath $taskNativeFixture -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $taskTestDirectory -Force -ErrorAction SilentlyContinue
}

$taskOwnedFixture = [pscustomobject]@{Id=12345;StartTime=[DateTime]::Now;ProcessName='powershell'}
$taskSavedFixture = [pscustomobject]@{pid=12345;started=$taskOwnedFixture.StartTime.ToUniversalTime().ToString('o')}
$taskCommandFixture = 'powershell.exe -File "' + (Join-Path $PSScriptRoot 'with-node.ps1') + '" pnpm dev'
if (-not (Test-VyanaOwnedProcess $taskOwnedFixture $taskSavedFixture $taskCommandFixture)) { throw 'Owned launcher was rejected.' }
if (Test-VyanaOwnedProcess $taskOwnedFixture $taskSavedFixture 'powershell.exe -File unrelated.ps1 pnpm dev') { throw 'Unrelated launcher was accepted.' }
$taskSavedFixture.started='old process timestamp'
if (Test-VyanaOwnedProcess $taskOwnedFixture $taskSavedFixture $taskCommandFixture) { throw 'A reused process ID was accepted.' }
Write-Output 'All three launcher ownership checks passed; no real process was stopped.'
