$ErrorActionPreference = 'Stop'
$taskCommandLine = @($args)
$taskExecutable = 'pnpm'
$taskArguments = @()
if ($taskCommandLine.Count -gt 0) { $taskExecutable = [string]$taskCommandLine[0] }
if ($taskCommandLine.Count -gt 1) { $taskArguments = $taskCommandLine[1..($taskCommandLine.Count - 1)] }
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskMinimum = [version]((Get-Content -LiteralPath (Join-Path $taskRoot '.nvmrc') -Raw).Trim().TrimStart('v'))
$taskPortable = Join-Path $taskRoot ".audit-runtime/node-runtime/node-v$taskMinimum-win-x64/node.exe"
$taskInstalled = Get-Command node -ErrorAction SilentlyContinue
$taskCandidates = @($taskPortable)
if ($taskInstalled) { $taskCandidates += $taskInstalled.Source }
$taskNode = $null
foreach ($taskCandidate in $taskCandidates) {
  if (-not (Test-Path -LiteralPath $taskCandidate -PathType Leaf)) { continue }
  $taskVersionText = (& $taskCandidate --version).Trim().TrimStart('v')
  if ($taskVersionText -notmatch '^\d+\.\d+\.\d+$') { continue }
  $taskVersion = [version]$taskVersionText
  if ($taskVersion.Major -eq 24 -and $taskVersion -ge $taskMinimum) {
    $taskNode = $taskCandidate
    break
  }
}
if (-not $taskNode) { throw "Install Node $taskMinimum or newer within 24.x before running host commands." }

$taskOriginalPath = $env:PATH
$taskExit = 1
try {
  $env:PATH = (Split-Path -Parent $taskNode) + [IO.Path]::PathSeparator + $env:PATH
  # Native tools commonly write progress to stderr; their exit code decides success.
  $null = Get-Command $taskExecutable -ErrorAction Stop
  $ErrorActionPreference = 'Continue'
  & $taskExecutable @taskArguments
  $taskExit = $LASTEXITCODE
} finally {
  $env:PATH = $taskOriginalPath
}
exit $taskExit
