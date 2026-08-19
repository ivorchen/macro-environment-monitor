$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = "C:\Users\ivorc\.cache\codex-runtimes\codex-primary-runtime\dependencies"
$nodeDirectory = Join-Path $runtimeRoot "node\bin"
$pnpmDirectory = Join-Path $runtimeRoot "bin\fallback"
$pnpmExecutable = Join-Path $pnpmDirectory "pnpm.cmd"

if (-not (Test-Path -LiteralPath $pnpmExecutable)) {
  throw "pnpm was not found at $pnpmExecutable"
}

$env:PATH = "$nodeDirectory;$pnpmDirectory;$env:PATH"
Set-Location -LiteralPath $projectRoot

Write-Host "Starting Macro Environment Monitor at http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the development server." -ForegroundColor DarkGray

& $pnpmExecutable dev
