$ErrorActionPreference = "SilentlyContinue"

$port = 8788
$targetPids = @()

$listeners = Get-NetTCPConnection -LocalPort $port -State Listen
if ($listeners) {
  $targetPids += $listeners | Select-Object -ExpandProperty OwningProcess
}

$wranglerNodes = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "node.exe" -and
    $_.CommandLine -match "wrangler" -and
    $_.CommandLine -match "pages dev" -and
    $_.CommandLine -match "--port=8788"
  } |
  Select-Object -ExpandProperty ProcessId

if ($wranglerNodes) {
  $targetPids += $wranglerNodes
}

$targetPids = $targetPids | Sort-Object -Unique

if (-not $targetPids -or $targetPids.Count -eq 0) {
  Write-Output "No stale Pages dev processes found."
  exit 0
}

foreach ($procId in $targetPids) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Output "Stopped PID $procId"
  } catch {
    Write-Output "Could not stop PID $procId ($($_.Exception.Message))"
  }
}

exit 0
